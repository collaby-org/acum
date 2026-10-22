/**
 * Mobile scan confirmation page.
 *
 * After scanning the TV's QR code, the phone lands here with the session
 * already in storage (localStorage cookie bridge). This page confirms the
 * session to the TV endpoint (`/api/auth/confirm-tv` POST) and then tells
 * the user to look at the TV screen.
 */
"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

export default function TVConfirmPage() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("acum-session") ?? sessionStorage.getItem("acum-session");
    if (!token) return;
    fetch("/api/auth/confirm-tv", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => r.ok && setDone(true))
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-dvh bg-[#0a0a0c] text-ink flex flex-col items-center justify-center px-6 text-center gap-5">
      <div className="size-16 rounded-full bg-signal/20 flex items-center justify-center">
        <Check className="size-8 text-signal" aria-hidden />
      </div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Autentificat pe TV</h1>
      <p className="text-sm text-ink-muted leading-relaxed max-w-sm">
        {done
          ? "Contul tău a fost transmis pe ecranul TV. Poți reveni la aplicație."
          : "Se conectează la TV…"}
      </p>
    </main>
  );
}
