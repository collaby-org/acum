"use client";
import { useState } from "react";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TVLoginQR() {
  const [scanned, setScanned] = useState(false);
  const qrUrl = typeof window !== "undefined" ? `${window.location.origin}/auth/callback?tv=1` : "/auth/callback?tv=1";

  return (
    <div className="min-h-dvh bg-[#0a0a0c] text-ink flex flex-col items-center justify-center px-6 text-center gap-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">Conectează-te pe TV</h1>
      <p className="text-sm text-ink-muted">Scanează cu telefonul pentru a te autentifica pe acest ecran.</p>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,1)]">
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrUrl)}`} alt="QR autentificare TV" className="rounded-xl w-48 h-48" />
      </div>
      <Button onClick={() => setScanned(true)} className="rounded-full bg-signal text-[#141005] font-medium px-6 py-3">Am scanat</Button>
      {scanned ? <p className="text-sm text-live">Cont conectat. Poți reveni pe ecran.</p> : null}
    </div>
  );
}
