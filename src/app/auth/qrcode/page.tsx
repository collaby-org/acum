import { Suspense } from "react";
import { TVQRCodeClient } from "@/components/tv/tv-qrcode-client";

export const dynamic = "force-dynamic";

export default function TVQRCodePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0a0a0c] grid place-items-center text-white/40">Se încarcă…</div>}>
      <TVQRCodeClient />
    </Suspense>
  );
}