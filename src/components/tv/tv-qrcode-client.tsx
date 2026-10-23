"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAccount } from "@/hooks/use-account";

export function TVQRCodeClient() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const { signedIn, ready } = useAccount();

  useEffect(() => {
    if (ready && signedIn) {
      window.location.href = "/tv";
    }
  }, [ready, signedIn]);

  if (!ready) {
    return (
      <main className="min-h-dvh bg-black grid place-items-center">
        <p className="text-white/40">Se incarca...</p>
      </main>
    );
  }

  if (mode === "phone") {
    return <MobileAuthPage />;
  }

  return <TVAuthQR />;
}

function TVAuthQR() {
  const [poll, setPoll] = useState(false);
  const url = typeof window !== "undefined"
    ? window.location.origin + "/auth/qrcode"
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
    <main className="min-h-dvh bg-black flex flex-col items-center justify-center px-6 text-center gap-8">
      <h1 className="font-display text-4xl font-bold tracking-tight text-white">Autentificare pe TV</h1>
      <p className="text-base text-white/50 max-w-md leading-relaxed">
        Scanear codul QR cu telefonul pentru a te autentifica pe acest dispozitiv.
      </p>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_60px_-16px_rgba(0,0,0,1)] backdrop-blur-xl inline-block">
        <img
          src={"https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=" + encodeURIComponent(url)}
          alt="Cod QR - conectare ACUM pe TV"
          className="rounded-xl w-96 h-96 mx-auto"
        />
      </div>
      <p className="text-xs text-white/30 tracking-wide uppercase font-medium">Scaneaza cu camera telefonului</p>
      {poll && <p className="text-sm text-green-400 font-medium">Autentificat. Redirectionare...</p>}
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
      setError(err instanceof Error ? err.message : "Eroare necunoscuta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-black flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <button
            onClick={() => { window.location.href = "/tv"; }}
            className="self-start inline-flex items-center gap-2 text-white/60 hover:text-white transition mb-6"
          >
            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Inapoi la TV
          </button>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            {isLogin ? "Autentificare" : "Creare cont"}
          </h1>
          <p className="mt-2 text-white/50">
            {isLogin
              ? "Introdu datele contului tau ACUM"
              : "Creaza-ti contul gratuit in cateva secunde"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-[0_20px_60px_-16px_rgba(0,0,0,1)] backdrop-blur-xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <span className="flex-shrink-0">!</span>
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
                className="w-full h-12 px-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition"
                placeholder="email@exemplu.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-2">
                Parola
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="w-full h-12 px-4 pr-12 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition"
                  placeholder="........"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
                >
                  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-base transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Se proceseaza..." : (isLogin ? "Autentificare" : "Creaza cont")}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-white/50 text-sm">
              {isLogin ? "Nu ai cont?" : "Ai deja cont?"}{" "}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(""); }}
                className="text-red-600 font-medium hover:underline"
              >
                {isLogin ? "Creaza cont" : "Autentificare"}
              </button>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-center text-xs text-white/30 mb-4">Sau continua direct pe TV</p>
            <a
              href="/tv"
              className="block w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
            >
              <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2-2v14a2 2 0 002 2z"/></svg>
              <span className="font-medium">Merg inapoi la TV</span>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}