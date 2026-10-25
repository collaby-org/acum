"use client";

import { useRef, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/site";

/**
 * The contact form.
 *
 * The message is written straight into the desk's table — there is no mail
 * step, no third party and no address of ours to hand over. The page says
 * so, because a visitor who waits for an e-mail that will never come is a
 * visitor who thinks the site is broken.
 *
 * The table has an insert policy for anybody and no read policy for the
 * anonymous key: a visitor can write, and nobody can read except the desk.
 * That is why the insert is the whole job.
 */

const CONTACT_SUBJECTS = [
  "Un canal nu pornește",
  "Întrebare despre ghidul TV",
  "Ce rulează acum pe un canal",
  "Cont și abonament",
  "Drepturi și drepturi de autor",
  "Semnalează un conținut",
  "Altele",
];

type Variant = "contact" | "proposal";

export type MessageFormProps = {
  /** Which page the message was written from. */
  page: string;
  /** The form's variant: a general message, or a channel proposal. */
  variant?: Variant;
};

export function MessageForm({ page, variant = "contact" }: MessageFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(
    variant === "proposal" ? "Propunere de canal" : CONTACT_SUBJECTS[0],
  );
  const [channel, setChannel] = useState("");
  const [source, setSource] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  const proposal = variant === "proposal";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;

    // A field only a robot fills in. The visitor sees a success screen and
    // nothing is written.
    if (honeypot.current?.value) {
      setState("sent");
      return;
    }

    setState("sending");
    setError(null);

    try {
      const { error } = await getSupabaseClient().from("messages").insert({
        name: name.trim(),
        email: email.trim(),
        subject: proposal
          ? `Propunere de canal: ${channel.trim() || "fără nume"}`
          : subject,
        body: proposal
          ? [
              `Canal propus: ${channel.trim() || "—"}`,
              source.trim() ? `Adresă: ${source.trim()}` : null,
              "",
              body.trim(),
            ]
              .filter((line) => line !== null)
              .join("\n")
          : body.trim(),
        page,
        agent:
          typeof navigator === "undefined"
            ? ""
            : navigator.userAgent.slice(0, 400),
        read: false,
        archived: false,
      });

      if (error) throw new Error(error.message);
      setState("sent");
    } catch (cause) {
      setState("error");
      setError(
        cause instanceof Error
          ? cause.message
          : "Mesajul nu a putut fi trimis.",
      );
    }
  }

  if (state === "sent") {
    return (
      <div
        role="status"
        className="relative overflow-hidden rounded-[var(--radius-panel)] border border-signal/25 bg-signal/[0.06] px-6 py-10 text-center sm:px-10"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 mix-blend-screen"
          style={{
            background:
              "radial-gradient(52% 62% at 50% 0%, hsl(38 92% 56% / 0.28) 0%, transparent 70%)",
          }}
        />
        <span className="mx-auto grid size-12 place-items-center rounded-full border border-signal/35 bg-signal/12">
          <Check aria-hidden className="size-5 text-signal-bright" />
        </span>
        <h2 className="mt-5 font-display text-xl font-semibold tracking-tight text-ink">
          {proposal ? "Propunerea a ajuns." : "Mesajul a ajuns."}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-ink-muted">
          {proposal ? (
            <>
              Canalul propus a ajuns în panoul echipei. Îl verificăm și, dacă
              merge, îl adăugăm. Nu s-a trimis niciun e-mail.
            </>
          ) : (
            <>
              Mesajul tău este în panoul echipei {SITE_NAME}, unde este citit.{" "}
              <strong className="font-semibold text-ink">
                Nu trimitem e-mail
              </strong>{" "}
              de pe site — de aceea nu aștepta o căsuță de e-mail, ci un
              răspuns dat de noi, în panou.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="relative overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.07] bg-white/[0.03] p-5 backdrop-blur-xl sm:p-7"
      noValidate={false}
    >
      <div aria-hidden className="fx-sheen absolute inset-0 opacity-50" />

      <div className="relative grid gap-4 sm:grid-cols-2">
        <Field label="Nume" required>
          <input
            type="text"
            name="name"
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Cum te cheamă"
            className={INPUT}
          />
        </Field>

        <Field
          label="E-mail"
          hint="Opțional. Nu trimidem e-mailuri, dar cu adresa ta putem să-ți răspundem din panou."
        >
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="adresa@exemplu.ro"
            className={INPUT}
          />
        </Field>

        {proposal ? (
          <>
            <Field label="Canalul propus" required>
              <input
                type="text"
                name="channel"
                required
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                placeholder="Numele canalului"
                className={INPUT}
              />
            </Field>
            <Field
              label="Unde se vede"
              hint="Opțional. O adresă publică de pe care se poate urmări canalul."
            >
              <input
                type="url"
                name="source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="https://"
                className={INPUT}
              />
            </Field>
          </>
        ) : (
          <Field label="Subiect" required className="sm:col-span-2">
            <select
              name="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className={cn(INPUT, "appearance-none bg-[right_0.9rem_center] pr-9")}
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23949cb2' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
              }}
            >
              {CONTACT_SUBJECTS.map((item) => (
                <option key={item} value={item} className="bg-canvas">
                  {item}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field
          label={proposal ? "De ce îl propui" : "Mesajul"}
          required
          className="sm:col-span-2"
        >
          <textarea
            name="body"
            required
            rows={proposal ? 5 : 7}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              proposal
                ? "Spune-ne pe scurt ce este canalul și de ce merită să fie în catalog."
                : "Scrie aici. Cu cât e mai concret, cu atât răspundem mai repede."
            }
            className={cn(INPUT, "min-h-[140px] resize-y py-3 leading-relaxed")}
          />
        </Field>
      </div>

      {/* A field only a robot fills in. */}
      <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          ref={honeypot}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {state === "error" ? (
        <p
          role="alert"
          className="relative mt-5 rounded-[var(--radius-card)] border border-live/30 bg-live/[0.08] px-4 py-3 text-[13px] leading-relaxed text-live-soft"
        >
          Mesajul nu a putut fi salvat: {error}. Încearcă din nou, sau scrie-ne
          de pe alt dispozitiv.
        </p>
      ) : null}

      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-md text-[12px] leading-relaxed text-ink-faint">
          Mesajul ajunge în panoul echipei {SITE_NAME}. Nu folosim adresa ta de e-mail
          pentru nimic altceva.
        </p>
        <button
          type="submit"
          disabled={state === "sending"}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-signal px-5 text-[14px] font-medium text-[#141005] shadow-[0_8px_28px_-10px_rgba(240,165,0,0.85)] transition-[transform,background-color,opacity] duration-300 ease-spring hover:bg-signal-bright active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
        >
          {state === "sending" ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Send aria-hidden className="size-4" />
          )}
          {state === "sending" ? "Se salvează…" : "Trimite mesajul"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * The field
 * ------------------------------------------------------------------ */

const INPUT =
  "w-full rounded-[var(--radius-card)] border border-white/[0.09] bg-black/25 px-3.5 py-2.5 text-[14px] text-ink outline-none transition-[border-color,box-shadow,background-color] duration-300 placeholder:text-ink-faint focus:border-signal/50 focus:bg-black/35 focus:shadow-[0_0_0_4px_rgba(242,167,27,0.10)]";

function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="flex items-baseline gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
        {label}
        {required ? (
          <span className="text-signal/80" aria-hidden>
            *
          </span>
        ) : (
          <span className="normal-case tracking-normal text-ink-faint/70">
            (opțional)
          </span>
        )}
      </span>
      <span className="mt-2 block">{children}</span>
      {hint ? (
        <span className="mt-1.5 block text-[11.5px] leading-relaxed text-ink-faint">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
