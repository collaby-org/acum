"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QrCode, Smartphone, Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useAccount } from "@/hooks/use-account";

export function TVQRCodeClient() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const { signedIn, ready } = useAccount();

  // If already signed in, redirect to /tv
  useEffect(() => {
    if (ready && signedIn) {
      window.location.href = "/tv";
    }
  }, [ready, signedIn]);

  if (!ready) {
    return (
      <main className="min-h-dvh bg-[#0a0a0c] grid place-items-center">
        <p className="text-white/40">Se încarcă…</p>
      </main>
    );
  }

  // If mode=phone, show mobile login/register page (not QR)
  if (mode === "phone") {
    return <MobileAuthPage />;
  }

  // Default: show QR for TV scanning
  return <TVAuthQR />;
}

function TVAuthQR() {
  const [poll, setPoll] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/auth/qrcode`
    : "/auth/qrcode";

  useEffect(() => {
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
          window.location.href = "/tv";
        }
      } catch { }
    }, 1500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="min-h-dvh bg-[#0a0a0c] flex flex-col items-center justify-center px-6 text-center gap-8">
      <h1 className="font-display text-4xl font-bold tracking-tight text-white">Autentificare TV</h1>
      <p className="text-base text-white/50 max-w-md leading-relaxed">
        Scanează cu telefonul pentru a autoriza acest ecran. Contul se va conecta automat.
      </p>
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_-16px_rgba(0,0,0,1)] backdrop-blur-xl">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=340x340&data=${encodeURIComponent(url)}`}
          alt="Cod QR — conectare ACUM pe TV"
          className="rounded-2xl w-80 h-80 mx-auto"
        />
      </div>
      <p className="text-xs text-white/30 tracking-wide uppercase font-medium">Scanează cu aplicația camerei</p>
      {poll && <p className="text-sm text-lime-400 font-medium">Autentificat. Redirecționare…</p>}
    </main>
  );
}

function MobileAuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(isLogin ? "/api/auth/callback?mode=login" : "/api/auth/callback?mode=register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Eroare");
      window.location.href = "/tv";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Eroare necunoscută");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[#0a0a0c] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <button
            onClick={() => window.location.href = "/tv"}
            className="self-start inline-flex items-center gap-2 text-white/60 hover:text-white transition mb-6"
          >
            <ArrowLeft className="size-5" aria-hidden />
            Înapoi la TV
          </button>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            {isLogin ? "Autentificare" : "Creare cont"}
          </h1>
          <p className="mt-2 text-white/50">
            {isLogin
              ? "Introdu datele contului tău ACUM"
              : "Creează-ți contul gratuit în câteva secunde"}
          </p>
        </div>

        {/* Auth Form */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_20px_60px_-16px_rgba(0,0,0,1)] backdrop-blur-xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <span className="flex-shrink-0">⚠</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full h-12 px-4 rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal transition"
                placeholder="email@exemplu.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-2">
                Parolă
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="w-full h-12 px-4 pr-12 rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal transition"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-signal px-6 text-base font-bold text-[#141005] shadow-[0_8px_30px_-10px_rgba(242,167,27,0.7)] transition hover:bg-signal-bright disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Se procesează…" : (isLogin ? "Autentificare" : "Creează cont")}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-white/50 text-sm">
              {isLogin ? "Nu ai cont?" : "Ai deja cont?"}{" "}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(""); }}
                className="text-signal font-medium hover:underline"
              >
                {isLogin ? "Creează cont" : "Autentificare"}
              </button>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-center text-xs text-white/30 mb-4">Sau continuă direct pe TV</p>
            <a
              href="/tv"
              className="block w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-white/12 bg-white/[0.06] text-white/80 transition hover:bg-white/[0.12]"
            >
              <Smartphone className="size-5" aria-hidden />
              <span className="font-medium">Merg înapoi la TV</span>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

function handleSubmit(e: React.FormEvent) {
  // placeholder - actual handler is in MobileAuthPage
  e.preventDefault();
}