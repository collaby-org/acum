/**
 * The checkout.
 *
 * `POST /api/checkout { product }` — a Stripe Checkout session for one of
 * the three products. The visitor is sent to the payment provider and comes
 * back to the app; the webhook is what actually turns the payment into a
 * plan.
 *
 * The Stripe API is called over `fetch`: the product carries no payment
 * dependency, and the three calls this route makes — create a session, read
 * a session, list the prices — are a form post and a JSON read.
 *
 * The app has to work without the keys. When they are missing the route
 * says so, in plain words, and the pricing page says the same before
 * anything is pressed. A payment that is not configured must never look
 * like a payment that went through, and it must never hand out a paid plan
 * for free.
 */
import { bearerToken, readUser } from "@/lib/supabase/server";
import { isProduct, type Product } from "@/lib/supabase/plans";


/** The Stripe API. The version is pinned so the shape of the answer is. */
const STRIPE_API = "https://api.stripe.com/v1";

/** The price of each product, from the environment. */
const PRICE_VARIABLES: Record<Product, string> = {
  monthly: "STRIPE_PRICE_MONTHLY",
  household: "STRIPE_PRICE_HOUSEHOLD",
  lifetime: "STRIPE_PRICE_LIFETIME",
};

/** How long the session may be open. */
const SESSION_EXPIRES_MINUTES = 30;

/**
 * True when the payments are ready to be taken.
 *
 * The secret key and the price of the product have to be there; without
 * them there is nothing to charge.
 */
export function stripeConfigured(product?: Product): boolean {
  if (!process.env.STRIPE_SECRET_KEY) return false;
  if (!product) return true;
  const variable = PRICE_VARIABLES[product];
  return Boolean(process.env[variable]);
}

/** The price id of a product, when it is configured. */
function priceId(product: Product): string | null {
  const value = process.env[PRICE_VARIABLES[product]];
  return value && value.length > 0 ? value : null;
}

/** The origin the visitor comes back to. */
function originOf(request: Request): string {
  const next = (request as Request & { nextUrl?: URL }).nextUrl;
  if (next?.origin) return next.origin;
  try {
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  let payload: { product?: unknown };
  try {
    payload = (await request.json()) as { product?: unknown };
  } catch {
    payload = {};
  }

  const product = payload.product;
  if (!isProduct(product)) {
    return Response.json(
      { error: "Planul cerut nu există." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  // The keys are read here, not at the top of the module: the app has to
  // start and run without them, and the pricing page has to be able to ask.
  //
  // The configuration is checked before the visitor is: a button that
  // cannot work must say so, whoever presses it.
  const secret = process.env.STRIPE_SECRET_KEY;
  const price = priceId(product);

  if (!secret || !price) {
    return Response.json(
      {
        error:
          "Plățile nu sunt configurate încă. Echipa noastră activează plata; până atunci, accesul gratuit rămâne disponibil.",
        code: "payments_not_configured",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  // A plan belongs to an account, so the account has to be there.
  const token = bearerToken(request);
  const user = token ? await readUser(token) : null;

  if (!user) {
    return Response.json(
      {
        error: "Autentifică-te înainte să cumperi un plan.",
        code: "not_signed_in",
      },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const origin = originOf(request);
  const lifetime = product === "lifetime";

  const body = new URLSearchParams();
  body.set("mode", lifetime ? "payment" : "subscription");
  body.set("line_items[0][price]", price);
  body.set("line_items[0][quantity]", "1");
  body.set(
    "success_url",
    `${origin}/conturi?achizitie=ok&plan=${product}`,
  );
  body.set("cancel_url", `${origin}/preturi?anulare=1`);
  body.set("client_reference_id", user.id);
  body.set("metadata[user_id]", user.id);
  body.set("metadata[product]", product);
  body.set("locale", "auto");
  body.set("expires_at", String(
    Math.floor(Date.now() / 1000) + SESSION_EXPIRES_MINUTES * 60,
  ));

  if (user.email) body.set("customer_email", user.email);

  // The subscription's own metadata is what a renewal carries, so the
  // webhook can find the account again without reading the customer.
  if (!lifetime) {
    body.set("subscription_data[metadata][user_id]", user.id);
    body.set("subscription_data[metadata][product]", product);
  }

  let response: Response;
  try {
    response = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });
  } catch {
    return Response.json(
      {
        error: "Nu am putut contacta serviciul de plăți. Încearcă din nou.",
        code: "payments_unreachable",
      },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  const answer = (await response.json().catch(() => null)) as {
    url?: unknown;
    id?: unknown;
    error?: { message?: unknown } | null;
  } | null;

  if (!response.ok) {
    const message =
      typeof answer?.error?.message === "string"
        ? answer.error.message
        : "Plata nu a putut fi pregătită.";

    return Response.json(
      { error: message, code: "checkout_failed" },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  const url = typeof answer?.url === "string" ? answer.url : null;
  const id = typeof answer?.id === "string" ? answer.id : null;

  if (!url) {
    return Response.json(
      { error: "Plata nu a putut fi pregătită.", code: "checkout_failed" },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  return Response.json(
    { id, url, product },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * The state of the payments.
 *
 * `GET /api/checkout` — whether the payments are configured, so the
 * interface can say so before the visitor presses anything.
 */
export async function GET() {
  return Response.json(
    {
      configured: stripeConfigured(),
      products: (Object.keys(PRICE_VARIABLES) as Product[]).filter((product) =>
        stripeConfigured(product),
      ),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
