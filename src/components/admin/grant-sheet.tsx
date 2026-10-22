/**
 * The grant panel.
 *
 * The owner's own shell: pick the plan, lift the paywall, say why. It
 * slides in from the right, over the list, so the account stays in sight
 * while it is being changed.
 *
 * Everything written here goes to the server with the service role. The
 * browser asks; the server decides and writes the audit line.
 */
"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { deskFetch } from "@/components/admin/session";
import type { Account, Plan } from "@/components/admin/types";
import { cn } from "@/lib/utils";

/** The plans the desk hands out, and what each of them means here. */
const OPTIONS: { plan: Plan; label: string; detail: string }[] = [
  { plan: "free", label: "Gratuit", detail: "Două ore pe zi." },
  { plan: "monthly", label: "Individual", detail: "Fără limită, reînnoit lunar." },
  { plan: "household", label: "Gospodărie", detail: "Patru locuri, o singură plată." },
  { plan: "lifetime", label: "Viață", detail: "O singură plată, fără reînnoiri." },
  { plan: "comp", label: "Concediat", detail: "De panou: intră și în panou." },
];

/** The plans that can end, and so need a date. */
const ENDS: readonly Plan[] = ["monthly", "household"];

export function GrantSheet({
  account,
  onClose,
  onGranted,
}: {
  account: Account | null;
  onClose: () => void;
  onGranted: (account: Account) => void;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [bypass, setBypass] = useState(false);
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = Boolean(account);

  const submit = async () => {
    if (!account || !plan || working) return;
    setWorking(true);
    setError(null);

    try {
      const response = await deskFetch("/api/admin/accounts/grant", {
        method: "POST",
        body: JSON.stringify({
          userId: account.id,
          plan,
          planUntil: until ? new Date(`${until}T23:59:59`).toISOString() : null,
          bypass,
          note,
        }),
      });

      const body = (await response.json()) as { account?: Account; error?: string };
      if (!response.ok || !body.account) {
        setError(body.error ?? "Contul nu a putut fi actualizat.");
        return;
      }

      onGranted(body.account);
      setPlan(null);
      setBypass(false);
      setUntil("");
      setNote("");
    } catch {
      setError("Nu am putut contacta serverul.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-[fade-up_0.2s_ease-out]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col",
            "border-l border-white/[0.08] bg-canvas-raised/95 shadow-[0_0_120px_-30px_rgba(0,0,0,1)] backdrop-blur-2xl",
            "data-[state=open]:animate-[fade-up_0.24s_ease-out] focus:outline-none",
          )}
        >
          <div className="flex items-start gap-4 border-b border-white/[0.07] px-6 py-5">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-display text-[19px] font-semibold tracking-[-0.01em] text-ink">
                Acordă acces
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 truncate text-[13px] text-ink-faint">
                {account?.email ?? account?.display_name ?? "Contul ales"}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className="grid size-9 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink"
              aria-label="Închide"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {account ? (
              <>
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                    Plan
                  </p>
                  <div className="mt-3 space-y-2">
                    {OPTIONS.map((option) => {
                      const active = plan === option.plan;
                      return (
                        <button
                          key={option.plan}
                          type="button"
                          onClick={() => setPlan(option.plan)}
                          aria-pressed={active}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-300",
                            active
                              ? "border-signal/45 bg-signal/10"
                              : "border-white/[0.07] bg-white/[0.02] hover:border-white/15",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center rounded-full border",
                              active
                                ? "border-signal bg-signal text-signal-ink"
                                : "border-white/15 bg-transparent",
                            )}
                          >
                            {active ? <Check className="size-3" aria-hidden /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block text-[14px] font-medium",
                                active ? "text-signal-bright" : "text-ink",
                              )}
                            >
                              {option.label}
                            </span>
                            <span className="block text-[12px] text-ink-faint">
                              {option.detail}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {plan && ENDS.includes(plan) ? (
                  <section className="mt-6">
                    <label
                      htmlFor="grant-until"
                      className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
                    >
                      Se încheie la
                    </label>
                    <input
                      id="grant-until"
                      type="date"
                      value={until}
                      onChange={(event) => setUntil(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-ink transition-colors duration-300 hover:border-white/20 focus:border-signal/60 focus:outline-none focus:ring-2 focus:ring-signal/25"
                    />
                    <p className="mt-1.5 text-[12px] text-ink-faint">
                      Lăsat gol, planul lunar primește o lună.
                    </p>
                  </section>
                ) : null}

                <section className="mt-6">
                  <button
                    type="button"
                    onClick={() => setBypass((value) => !value)}
                    aria-pressed={bypass}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-300",
                      bypass
                        ? "border-signal/45 bg-signal/10"
                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/15",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border",
                        bypass
                          ? "border-signal bg-signal text-signal-ink"
                          : "border-white/15 bg-transparent",
                      )}
                    >
                      {bypass ? <Check className="size-3" aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-[14px] font-medium",
                          bypass ? "text-signal-bright" : "text-ink",
                        )}
                      >
                        Bypass de plată
                      </span>
                      <span className="block text-[12px] leading-relaxed text-ink-faint">
                        Peretele de plată nu se mai aplică acestui cont, oricare
                        ar fi planul.
                      </span>
                    </span>
                  </button>
                </section>

                <section className="mt-6">
                  <label
                    htmlFor="grant-note"
                    className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
                  >
                    Motiv
                  </label>
                  <textarea
                    id="grant-note"
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={400}
                    placeholder="De ce se acordă accesul. Rămâne în istoricul contului."
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm leading-relaxed text-ink transition-colors duration-300 placeholder:text-ink-faint hover:border-white/20 focus:border-signal/60 focus:outline-none focus:ring-2 focus:ring-signal/25"
                  />
                </section>

                {account.note ? (
                  <section className="mt-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                      Istoric
                    </p>
                    <ul className="mt-2.5 space-y-2 rounded-xl border border-white/[0.07] bg-[#07080e] p-3.5">
                      {account.note
                        .split("\n")
                        .filter(Boolean)
                        .slice(-6)
                        .reverse()
                        .map((line) => (
                          <li
                            key={line}
                            className="text-[12px] leading-relaxed text-ink-faint"
                          >
                            {line}
                          </li>
                        ))}
                    </ul>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="border-t border-white/[0.07] px-6 py-5">
            {error ? (
              <p
                role="alert"
                className="mb-3 rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-[#ffb3b8]"
              >
                {error}
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-full border border-white/10 bg-white/[0.04] px-5 text-[14px] font-medium text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink"
              >
                Renunță
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!plan || working}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-signal px-5 text-[14px] font-semibold text-signal-ink transition-[background-color,transform] duration-300 hover:bg-signal-bright active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
              >
                {working ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck className="size-4" aria-hidden />
                )}
                Acordă accesul
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
