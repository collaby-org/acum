/**
 * The way back from the identity provider.
 *
 *   /auth/callback
 *
 * Google sends the visitor here with the answer in the address. When the
 * answer is a *refusal* — the consent screen was closed, the provider is not
 * configured, the link expired — the reason is in the query string, and this
 * page says so in Romanian, on the server, as a page. A person who has just
 * tried to sign in never meets a JSON body or the framework's own screen.
 *
 * When the answer is a code or a token, the browser finishes the exchange:
 * the client that started the sign-in is the one holding the flow's verifier
 * and the storage where the session lives.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { AcumMark } from "@/components/brand";
import { CallbackExchange } from "./exchange";

export const metadata: Metadata = {
  title: "Autentificare",
  robots: { index: false, follow: false },
};

// The answer arrives in the query string, so the page is read per request.
export const instant = false;

/** What the provider's error code means, in the visitor's language. */
const REASONS: Record<string, string> = {
  access_denied: "Autentificarea a fost anulată înainte să se încheie.",
  server_error: "Furnizorul de autentificare nu a răspuns. Încearcă din nou.",
  temporarily_unavailable:
    "Autentificarea este indisponibilă pentru câteva momente. Încearcă din nou.",
  invalid_request: "Cererea de autentificare nu a fost acceptată.",
  unauthorized_client:
    "Autentificarea cu acest furnizor nu este disponibilă momentan.",
};

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const failed = params.error;
  const code = typeof failed === "string" ? failed : null;

  if (code) {
    const reason = REASONS[code] ?? "Autentificarea nu s-a încheiat.";

    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-6 py-24 text-center">
        <div className="max-w-sm">
          <span className="mx-auto grid size-12 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_12px_30px_-16px_rgba(242,167,27,0.85)]">
            <AcumMark id="acum-mark-callback" className="size-7" />
          </span>
          <h1 className="mt-8 font-display text-2xl font-bold tracking-tight">
            Autentificarea nu s-a încheiat
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{reason}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
            Poți încerca din nou, sau intra cu adresa de e-mail și parola.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/canale"
              className="inline-flex h-11 items-center rounded-full bg-signal px-6 text-sm font-medium text-[#141005] transition hover:bg-signal-bright"
            >
              Deschide catalogul
            </Link>
            <Link
              href="/conturi"
              className="inline-flex h-11 items-center rounded-full border border-white/12 px-6 text-sm text-ink transition hover:border-white/25 hover:bg-white/[0.04]"
            >
              Autentificare
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <CallbackExchange />;
}
