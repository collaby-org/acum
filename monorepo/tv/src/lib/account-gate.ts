/**
 * The gate.
 *
 * The free plan may watch two hours a day. The limit has to be enforced where
 * the pipe is, not where the picture is: the browser's own gate is a
 * suggestion, and a suggestion can be ignored.
 *
 * So the gate stands in front of the **manifest** — the route that mints the
 * signed address of a stream. A visitor whose allowance is spent gets no
 * address at all: there is nothing to pull, so there is nothing to bypass.
 * The check is the server's own: the account is authenticated first, then
 * its state is read with the service role because the state RPC is not
 * exposed to browser sessions. The browser never gets a say in it.
 */
import { bearerToken, getServiceClient, readUser } from "@/lib/supabase/server";

export type GateVerdict = {
  /** True when the picture may play. */
  allowed: boolean;
  /** Why it may not, when it may not. */
  reason: "signed_out" | "signed_in" | "spent" | "unknown";
  /** The account, when there is one. */
  userId: string | null;
};

/** How long a signed-in account's state is trusted before it is read again. */
const TRUST_MS = 5_000;

/** userId -> the moment the state was read. */
const lastRead = new Map<string, number>();

/** userId -> the last verdict. */
const lastVerdict = new Map<string, GateVerdict>();

/**
 * Whether this request may have a stream.
 *
 * An anonymous request is not allowed: watching needs an account, and the
 * free account is the two hours a day.
 */
export async function gate(request: Request): Promise<GateVerdict> {
  const token = bearerToken(request);
  if (!token) {
    return { allowed: false, reason: "signed_out", userId: null };
  }

  let userId: string | null = null;
  try {
    const user = await readUser(token);
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  if (!userId) {
    return { allowed: false, reason: "signed_out", userId: null };
  }

  const since = lastRead.get(userId) ?? 0;
  if (Date.now() - since < TRUST_MS) {
    const cached = lastVerdict.get(userId);
    if (cached) return cached;
  }

  // Access is denied until a trusted read says otherwise. An RPC error must
  // never turn into an unrestricted stream.
  let verdict: GateVerdict = {
    allowed: false,
    reason: "unknown",
    userId,
  };

  try {
    const client = getServiceClient();
    const { data, error } = await client.rpc("account_state", {
      p_user: userId,
    });

    if (error) {
      console.error("[account-gate] account_state failed", {
        userId,
        message: error.message,
      });
    } else if (!data || typeof data !== "object") {
      console.error("[account-gate] account_state returned no state", { userId });
    } else {
      const state = data as {
        bypass?: boolean;
        plan?: string;
        minutes_watched_today?: number;
        allowance_minutes?: number;
      };
      const allowance = state.allowance_minutes ?? 0;
      const watched = state.minutes_watched_today ?? 0;
      const spent = allowance > 0 && watched >= allowance;

      verdict = {
        allowed: Boolean(state.bypass) || !spent,
        reason: state.bypass ? "signed_in" : spent ? "spent" : "signed_in",
        userId,
      };
    }
  } catch (error) {
    console.error("[account-gate] account state could not be read", {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  lastRead.set(userId, Date.now());
  lastVerdict.set(userId, verdict);
  return verdict;
}
