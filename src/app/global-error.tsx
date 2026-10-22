"use client";

import Link from "next/link";

/**
 * The last resort.
 *
 * `error.tsx` needs a root layout to sit inside; when the layout itself — or
 * the stylesheet — is what failed, the framework replaces the document and
 * this component draws all of it. Tailwind is not guaranteed to be loaded at
 * that point, so the styling is inline: dark canvas, gold action, the same
 * words as every other screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ro">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b0b0c",
          color: "#f5f2ea",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          textAlign: "center",
          padding: "48px 24px",
        }}
      >
        <div style={{ maxWidth: 440 }}>
          <h1 style={{ fontSize: 30, margin: 0, letterSpacing: "-0.02em" }}>
            Ceva nu a mers
          </h1>
          <p
            style={{
              color: "#a8a29a",
              fontSize: 14,
              lineHeight: 1.6,
              margin: "12px 0 28px",
            }}
          >
            Pagina nu a putut fi încărcată. Canalele sunt în continuare aici.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                height: 44,
                padding: "0 24px",
                borderRadius: 999,
                border: 0,
                background: "#f2a71b",
                color: "#141005",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reîncearcă
            </button>
            <Link
              href="/canale"
              style={{
                height: 44,
                display: "inline-flex",
                alignItems: "center",
                padding: "0 24px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#f5f2ea",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Înapoi la canale
            </Link>
          </div>
          {error.digest ? (
            <p style={{ color: "#6f6a63", fontSize: 11, marginTop: 28 }}>
              Cod: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
