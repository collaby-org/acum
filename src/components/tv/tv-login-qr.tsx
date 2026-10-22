"use client";

import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";

export function TVLoginQR() {
  const [poll, setPoll] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/auth/qrcode`
    : "/auth/qrcode";

  useEffect(() => {
    // Poll the cookie endpoint: once the phone has confirmed the session,
    // the server writes a tv-session cookie, and the response carries it.
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/auth/confirm-tv", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (response.ok) {
          setPoll(true);
          window.clearInterval(timer);
          window.location.reload();
        }
      } catch {
        /* session not yet written — continue polling */
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="min-h-dvh bg-[#0a0a0c] flex flex-col items-center justify-center px-6 text-center gap-8">
      <h1 className="font-display text-4xl font-bold tracking-tight text-ink">Conectează-te pe TV</h1>
      <p className="text-base text-ink-muted max-w-md leading-relaxed">
        Scanează cu telefonul pentru a autoriza acest ecran. Contul se va conecta automat.
      </p>
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_-16px_rgba(0,0,0,1)] backdrop-blur-xl">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`}
          alt="Cod QR — conectare ACUM pe TV"
          className="rounded-2xl w-72 h-72"
        />
      </div>
      <p className="text-xs text-ink-faint tracking-wide uppercase font-medium">Scanează cu aplicația camerei</p>
      {poll ? <p className="text-sm text-live font-medium">Autentificat. Se încarcă…</p> : null}
    </main>
  );
}
