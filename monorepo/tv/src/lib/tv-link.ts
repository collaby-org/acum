/**
 * The TV link: how a phone hands its session to a television.
 *
 * A television cannot type a password, and a QR code alone is only a
 * promise — the phone has to be the one that says "yes, this screen is
 * mine" while it is already signed in. So the flow is three steps:
 *
 *   1. the TV asks for a code and shows it as a QR; the code encodes the
 *      phone's own address, `?code=…&tv_id=…`, and lives five minutes;
 *   2. the phone opens that address, signs in if it has not, and confirms
 *      — the confirmation carries the phone's session token, and the
 *      bridge writes the pair down;
 *   3. the TV polls the bridge with its code until the pair exists, then
 *      takes the session and never looks back.
 *
 * The code is the only thing the TV knows, so it is the only thing the
 * bridge accepts as proof: a confirmation without a valid code is
 * refused, and a code that has expired refuses everything.
 *
 * The store is server-only — the service role is the only thing that can
 * read and write these rows without a policy that would let one visitor
 * read another's session.
 */

import { cookies } from "next/headers";
import { getServiceClient, hasServiceRole } from "@/lib/supabase/server";

/** How long a code lives before the TV has to ask for a new one. */
export const TV_CODE_TTL_SECONDS = 5 * 60;

/** The characters a code is drawn from: no vowels, no look-alikes. */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** How many characters a code carries. */
const CODE_LENGTH = 8;

/** The table the bridge lives in. */
const TABLE = "tv_link_codes";

export type TvLinkStatus = "pending" | "confirmed" | "expired";

export type TvLinkRecord = {
  code: string;
  /** The device the code was issued to — echoed back on confirmation. */
  tv_id: string | null;
  status: TvLinkStatus;
  /** The session the phone handed over, once it confirmed. */
  access_token: string | null;
  created_at: string;
  expires_at: string;
};

/** A code, drawn so a person reading it off the television gets it right. */
export function generateTvCode(): string {
  let code = "";
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

/** True when the value could be a code this bridge issued. */
export function isTvCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === CODE_LENGTH &&
    [...value].every((c) => CODE_ALPHABET.includes(c))
  );
}

/**
 * Issue a code for a television.
 *
 * The code is written with `pending`; the session arrives later, when the
 * phone confirms. An old code for the same device is left alone — a
 * television that asked twice has two codes and the first still works.
 */
export async function issueTvCode(tvId: string | null): Promise<TvLinkRecord> {
  const service = getServiceClient();
  const code = generateTvCode();
  const now = new Date();
  const expires = new Date(now.getTime() + TV_CODE_TTL_SECONDS * 1000);

  const { data, error } = await service
    .from(TABLE)
    .insert({
      code,
      tv_id: tvId,
      status: "pending",
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Codul TV nu a putut fi scris: ${error?.message ?? "necunoscut"}`);
  }

  return data as TvLinkRecord;
}

/**
 * Read a code as the bridge holds it.
 *
 * Expiry is checked against the clock rather than trusted from the row:
 * a cron that never runs must not leave a dead code looking alive.
 */
export async function readTvCode(code: string): Promise<TvLinkRecord | null> {
  if (!isTvCode(code)) return null;

  const service = getServiceClient();
  const { data, error } = await service
    .from(TABLE)
    .select()
    .eq("code", code)
    .maybeSingle();

  if (error || !data) return null;

  const record = data as TvLinkRecord;
  if (new Date(record.expires_at).getTime() <= Date.now()) {
    return { ...record, status: "expired" };
  }
  return record;
}

/**
 * The session a phone handed over, when the code is confirmed and fresh.
 *
 * The TV polls this; `null` means "not yet". An expired code returns null
 * forever, so the television stops waiting and asks for a new one.
 */
export async function tvSessionFor(
  code: string,
): Promise<{ accessToken: string } | null> {
  const record = await readTvCode(code);
  if (!record || record.status !== "confirmed" || !record.access_token) {
    return null;
  }
  return { accessToken: record.access_token };
}

/**
 * The phone confirms a code, handing over its own session.
 *
 * The token is the phone's own — it is never written anywhere the
 * television reads except this one row, and the row is spent the moment
 * the television takes it. Confirming an expired or unknown code is
 * refused, and confirming a code that is already confirmed is a no-op
 * rather than a way to swap somebody else's session onto a screen.
 */
export async function confirmTvCode(
  code: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; reason: "unknown" | "expired" | "used" }> {
  const record = await readTvCode(code);
  if (!record) return { ok: false, reason: "unknown" };
  if (record.status === "expired") return { ok: false, reason: "expired" };
  if (record.status === "confirmed") return { ok: false, reason: "used" };

  const service = getServiceClient();
  const { error } = await service
    .from(TABLE)
    .update({ status: "confirmed", access_token: accessToken })
    .eq("code", code)
    .eq("status", "pending");

  if (error) return { ok: false, reason: "unknown" };
  return { ok: true };
}

/** Spend a code once the television has taken the session. */
export async function consumeTvCode(code: string): Promise<void> {
  const service = getServiceClient();
  await service.from(TABLE).delete().eq("code", code);
}

/**
 * The visitor's own token, from the request that carries it.
 *
 * The phone's session arrives the way every other session does: a bearer
 * header, or the mirrored session cookie. A confirmation without one is
 * a phone that is not signed in, and there is nothing to hand over.
 */
export async function callerToken(request: Request): Promise<string | null> {
  const header = (request.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (header) return header;

  try {
    const jar = await cookies();
    for (const cookie of jar.getAll()) {
      if (!cookie.name.startsWith("acum-session")) continue;
      const raw = cookie.value;
      try {
        const decoded = JSON.parse(
          Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
            "utf8",
          ),
        ) as { access_token?: unknown };
        if (typeof decoded.access_token === "string") return decoded.access_token;
      } catch {
        /* A cookie that does not decode is not this bridge's business. */
      }
    }
  } catch {
    /* A context without cookies has no cookie to offer. */
  }

  return null;
}

/** True when the bridge can be used at all — the service key is present. */
export function tvBridgeReady(): boolean {
  return hasServiceRole();
}
