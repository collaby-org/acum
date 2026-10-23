/**
 * The Stripe webhook.
 *
 * `POST /api/webhook/stripe` — the payment provider tells us what happened.
 * This is the only place where a payment becomes a plan: the checkout route
 * sends the visitor to the provider and waits, and nothing here trusts the
 * browser.
 *
 * The signature is checked before the body is read. The signed payload is
 * the timestamp and the raw body, exactly as they arrived, and the
 * comparison is a constant-time one — a webhook that answers to anything is
 * a webhook anyone can call.
 *
 * The plan is written with the service role, because the row level policies
 * keep the plan out of the visitor's hands on purpose.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";
import { planDefinition, type Product } from "@/lib/supabase/plans";


/** How old a webhook may be, in seconds. */
const TOLERANCE_SECONDS = 300;

/** The smallest unit of the currency, in seconds — a month, roughly. */
const MONTH_SECONDS = 30 * 24 * 60 * 60;

/**
 * Check the `Stripe-Signature` header.
 *
 * The header carries the moment the provider signed the body and one or more
 * signatures. The signed payload is `<timestamp>.<raw body>`; the signature
 * is the HMAC-SHA256 of that string, in hex, under the webhook secret.
 */
export function verifySignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;

  const parts = new Map<string, string[]>();
  for (const piece of header.split(",")) {
    const [key, value] = piece.split("=");
    if (!key || !value) continue;
    const list = parts.get(key.trim()) ?? [];
    list.push(value.trim());
    parts.set(key.trim(), list);
  }

  const timestamp = parts.get("t")?.[0];
  const signatures = parts.get("v1") ?? [];
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(nowSeconds - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  const given = Buffer.from(expected, "utf8");
  for (const signature of signatures) {
    const candidate = Buffer.from(signature, "utf8");
    if (candidate.length !== given.length) continue;
    if (timingSafeEqual(candidate, given)) return true;
  }

  return false;
}

/* ------------------------------------------------------------------ *
 * The event
 * ------------------------------------------------------------------ */

type StripeEvent = {
  id?: unknown;
  type?: unknown;
  data?: { object?: Record<string, unknown> } | null;
};

type SubscriptionRow = {
  user_id: string;
  product: Product;
  provider: string;
  provider_ref: string;
  amount: number | null;
  currency: string;
  status: "active" | "cancelled" | "past_due" | "expired";
  started_at: string;
  renews_at: string | null;
};

/** A string field of an object, when it is one. */
function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** A number field of an object, when it is one. */
function amount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The moment a period ends, as an ISO string. */
function iso(seconds: unknown): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

/** The product a session or a subscription carries. */
function productOf(object: Record<string, unknown>): Product | null {
  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const candidate = text(metadata.product) ?? text(object.price_lookup_key);
  if (candidate === "monthly" || candidate === "household" || candidate === "lifetime") {
    return candidate;
  }
  return null;
}

/** The account an event belongs to. */
function userOf(object: Record<string, unknown>): string | null {
  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  return (
    text(metadata.user_id) ??
    text(object.client_reference_id) ??
    text(metadata.client_reference_id)
  );
}

/**
 * Write the plan onto the profile.
 *
 * The service role is the only thing that can do this — the trigger in the
 * schema throws for everybody else, on purpose.
 */
async function setPlan(
  userId: string,
  plan: string,
  planUntil: string | null,
): Promise<void> {
  await getServiceClient()
    .from("profiles")
    .update({ plan, plan_until: planUntil })
    .eq("id", userId);
}

/** The household a payment buys, when it buys one. */
async function ensureHousehold(
  userId: string,
  seats: number,
): Promise<string | null> {
  const client = getServiceClient();

  const { data: profile } = await client
    .from("profiles")
    .select("household_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.household_id) return profile.household_id;

  const { data: household, error } = await client
    .from("households")
    .insert({ owner_id: userId, seats, name: "Gospodărie" })
    .select("id")
    .single();

  if (error || !household) return null;

  await client
    .from("profiles")
    .update({ household_id: household.id })
    .eq("id", userId);

  return household.id;
}

/** Write the purchase down. */
async function recordSubscription(row: SubscriptionRow): Promise<void> {
  const client = getServiceClient();

  const { error } = await client
    .from("subscriptions")
    .upsert(row, { onConflict: "provider,provider_ref", ignoreDuplicates: false });

  if (error) {
    // A renewal for a purchase that is already written is not a failure;
    // anything else is worth knowing about.
    const { data: existing } = await client
      .from("subscriptions")
      .select("id")
      .eq("provider", row.provider)
      .eq("provider_ref", row.provider_ref)
      .maybeSingle();

    if (!existing) throw error;
  }
}

/** A purchase that is now active: the plan goes on. */
async function activate(
  userId: string,
  product: Product,
  reference: string,
  money: number | null,
  currency: string,
  renewsAt: string | null,
): Promise<void> {
  const definition = planDefinition(product);
  const seats = definition.seats;

  if (product === "household") {
    await ensureHousehold(userId, seats);
  }

  await recordSubscription({
    user_id: userId,
    product,
    provider: "stripe",
    provider_ref: reference,
    amount: money,
    currency: currency.toLowerCase(),
    status: "active",
    started_at: new Date().toISOString(),
    renews_at: renewsAt,
  });

  await setPlan(userId, product, renewsAt);
}

/** A purchase that was cancelled: the account goes back to the free plan. */
async function deactivate(reference: string, userId: string | null): Promise<void> {
  const client = getServiceClient();

  await client
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("provider", "stripe")
    .eq("provider_ref", reference);

  if (!userId) return;

  const { data: profile } = await client
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  // A lifetime purchase never ends, so it is left alone.
  if (profile?.plan === "lifetime") return;

  await setPlan(userId, "free", null);
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    return Response.json(
      { error: "STRIPE_WEBHOOK_SECRET nu este setat." },
      { status: 500 },
    );
  }

  // The body has to be read as it arrived: the signature is computed over
  // these exact bytes.
  const payload = await request.text();
  const header = request.headers.get("stripe-signature");

  if (!verifySignature(payload, header, secret)) {
    return Response.json({ error: "Semnătură invalidă." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return Response.json({ error: "Eveniment invalid." }, { status: 400 });
  }

  const type = text(event.type);
  const object = event.data?.object ?? null;
  if (!type || !object) {
    return Response.json({ received: true });
  }

  try {
    switch (type) {
      case "checkout.session.completed": {
        const userId = userOf(object);
        const product = productOf(object);
        if (!userId || !product) break;

        const reference =
          text(object.subscription) ?? text(object.id) ?? "unknown";
        const money = amount(object.amount_total);
        const currency = text(object.currency) ?? "gbp";
        const mode = text(object.mode);

        if (mode === "payment") {
          // The lifetime: one payment, one reference, no renewal.
          await activate(userId, product, reference, money, currency, null);
          break;
        }

        const renewsAt = new Date(Date.now() + MONTH_SECONDS * 1000).toISOString();
        await activate(userId, product, reference, money, currency, renewsAt);
        break;
      }

      case "invoice.paid": {
        const userId = userOf(object);
        const reference = text(object.subscription) ?? text(object.id);
        if (!reference) break;

        // The period end lives on the invoice line.
        const lines = (object.lines as { data?: unknown } | undefined)?.data;
        const line = (Array.isArray(lines) ? lines[0] : null) as
          | { period?: { end?: unknown } }
          | null;
        const periodEnd = line?.period?.end;
        const renewsAt = iso(periodEnd);

        if (userId) {
          const product = productOf(object);
          if (product) {
            await activate(
              userId,
              product,
              reference,
              amount(object.amount_paid),
              text(object.currency) ?? "gbp",
              renewsAt,
            );
            break;
          }
        }

        // The invoice carries no metadata: the account is found through the
        // subscription that was written when the checkout completed.
        const { data: existing } = await getServiceClient()
          .from("subscriptions")
          .select("user_id, product")
          .eq("provider", "stripe")
          .eq("provider_ref", reference)
          .maybeSingle();

        if (!existing) break;

        await getServiceClient()
          .from("subscriptions")
          .update({
            status: "active",
            renews_at: renewsAt,
            amount: amount(object.amount_paid),
          })
          .eq("provider", "stripe")
          .eq("provider_ref", reference);

        await setPlan(existing.user_id, existing.product, renewsAt);
        break;
      }

      case "customer.subscription.updated": {
        const status = text(object.status);
        const reference = text(object.id);
        if (!reference) break;

        if (status === "active") {
          const { data: existing } = await getServiceClient()
            .from("subscriptions")
            .select("user_id, product")
            .eq("provider", "stripe")
            .eq("provider_ref", reference)
            .maybeSingle();

          if (existing) {
            const renewsAt = iso(object.current_period_end);
            await getServiceClient()
              .from("subscriptions")
              .update({
                status: "active",
                renews_at: renewsAt,
              })
              .eq("provider", "stripe")
              .eq("provider_ref", reference);
            await setPlan(existing.user_id, existing.product, renewsAt);
          }
          break;
        }

        if (status === "past_due" || status === "unpaid") {
          await getServiceClient()
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("provider", "stripe")
            .eq("provider_ref", reference);
          break;
        }

        if (status === "canceled" || status === "cancelled") {
          await deactivate(reference, userOf(object));
        }
        break;
      }

      case "customer.subscription.deleted": {
        const reference = text(object.id);
        if (reference) await deactivate(reference, userOf(object));
        break;
      }

      default:
        // Everything else is acknowledged and ignored: the provider retries
        // on a non-2xx answer, and an event we do not know is not an error.
        break;
    }
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Evenimentul nu a putut fi aplicat.";
    return Response.json({ error: message }, { status: 500 });
  }

  return Response.json({ received: true });
}
