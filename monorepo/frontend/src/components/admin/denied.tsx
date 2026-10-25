/**
 * The desk, when it does not open.
 *
 * Three ways this happens, and each of them says what to do about it: the
 * owner is not signed in, the account is not a desk account, or the desk
 * has no key to read the database with. A desk that cannot work must say
 * so — not show an empty product and let it look like a quiet day.
 */
"use client";

import { KeyRound, LogIn, ShieldAlert } from "lucide-react";
import { SignInForm } from "@/components/account/sign-in-form";

export type DeskDenial = {
  status: "signed-out" | "forbidden" | "no-key" | "error";
  message?: string | null;
  email?: string | null;
};

export function DeskDenied({
  denial,
  onSignedIn,
}: {
  denial: DeskDenial;
  onSignedIn?: () => void;
}) {
  if (denial.status === "signed-out") {
    return (
      <Shell
        icon={<LogIn className="size-5 text-signal" aria-hidden />}
        eyebrow="Panou de administrare"
        title="Conectează-te"
        lead="Panoul se deschide cu același cont ca aplicația. Contul trebuie să fie unul de panou: planul «Concediat», bypass activ, sau e-mailul în lista ADMIN_EMAILS."
      >
        <SignInForm
          initialMode="signin"
          onSuccess={() => onSignedIn?.()}
          className="max-w-sm"
        />
      </Shell>
    );
  }

  if (denial.status === "no-key") {
    return (
      <Shell
        icon={<KeyRound className="size-5 text-signal" aria-hidden />}
        eyebrow="Configurare"
        title="Lipsește cheia de service role"
        lead="Panoul citește conturile, mesajele și statisticile cu cheia de service role. Fără ea nu poate citi nimic — și nu vrea să arate un produs gol în locul unuia plin."
      >
        <div className="rounded-xl border border-white/[0.08] bg-[#07080e] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
            Se setează în mediul aplicației
          </p>
          <pre className="mt-2.5 overflow-x-auto font-mono text-[12.5px] leading-relaxed text-signal-bright">
            SUPABASE_SERVICE_ROLE_KEY=...
          </pre>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
            Cheia se ține pe server și nu ajunge niciodată în browser. Cu ea
            setată, panoul se deschide la următoarea reîncărcare.
          </p>
        </div>
        <p className="text-[12px] text-ink-faint">
          E-mailurile de panou se țin în <code>ADMIN_EMAILS</code>, separate
          prin virgulă.
        </p>
      </Shell>
    );
  }

  if (denial.status === "forbidden") {
    return (
      <Shell
        icon={<ShieldAlert className="size-5 text-live-soft" aria-hidden />}
        eyebrow="Acces interzis"
        title="Acest cont nu intră în panou"
        lead={
          denial.email
            ? `Contul ${denial.email} nu poate deschide panoul.`
            : "Contul cu care ești conectat nu poate deschide panoul."
        }
      >
        <p className="text-[13px] leading-relaxed text-ink-muted">
          Un cont de panou are unul dintre trei semne: planul{" "}
          <span className="text-ink">Concediat</span>, bypass activ, sau
          e-mailul în lista <code>ADMIN_EMAILS</code> din mediul aplicației.
          Cere-i proprietarului să îți dea unul dintre ele.
        </p>
      </Shell>
    );
  }

  return (
    <Shell
      icon={<ShieldAlert className="size-5 text-live-soft" aria-hidden />}
      eyebrow="Eroare"
      title="Panoul nu a putut citi datele"
      lead={denial.message ?? "Ceva nu a mers. Încearcă din nou."}
    >
      <p className="text-[13px] leading-relaxed text-ink-muted">
        Verifică dacă proiectul Supabase răspunde și dacă cheia de service
        role este încă setată.
      </p>
    </Shell>
  );
}

function Shell({
  icon,
  eyebrow,
  title,
  lead,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  lead: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center">
      <div className="w-full rounded-[20px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.014))] p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_30px_70px_-40px_rgba(0,0,0,1)]">
        <span className="grid size-11 place-items-center rounded-[13px] border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02]">
          {icon}
        </span>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-signal/85">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-display text-[24px] font-semibold tracking-[-0.02em] text-ink">
          {title}
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-ink-muted">
          {lead}
        </p>
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </div>
  );
}
