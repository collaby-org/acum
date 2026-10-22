/**
 * The messages.
 *
 * What the contact form wrote, read with the service role — the table
 * gives that to nobody else. Unread first, then the rest, then whatever
 * was put away.
 */
"use client";

import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Inbox, Loader2, Mail, MailOpen } from "lucide-react";
import { DeskDenied } from "@/components/admin/denied";
import {
  Panel,
  Pill,
  SectionTitle,
  formatDateTime,
} from "@/components/admin/parts";
import { deskFetch, useDeskResource } from "@/components/admin/session";
import type { Message, MessagesPayload } from "@/components/admin/types";
import { cn } from "@/lib/utils";

const STATES = [
  { key: "inbox", label: "Primite" },
  { key: "unread", label: "Necitite" },
  { key: "archived", label: "Arhivate" },
] as const;

type StateKey = (typeof STATES)[number]["key"];

export function MessagesPanel() {
  const [state, setState] = useState<StateKey>("inbox");
  const path = useMemo(() => `/api/admin/messages?state=${state}`, [state]);
  const { data, status, message, reload } = useDeskResource<MessagesPayload>(path);

  const change = async (id: string, patch: { read?: boolean; archived?: boolean }) => {
    const response = await deskFetch(`/api/admin/messages/${id}`, {
      method: "POST",
      body: JSON.stringify(patch),
    });
    if (response.ok) reload();
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="inline-flex items-center gap-3 text-[13px] text-ink-faint">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Se citesc mesajele…
        </span>
      </div>
    );
  }

  if (status !== "ok" || !data) {
    return (
      <DeskDenied
        denial={{
          status:
            status === "signed-out"
              ? "signed-out"
              : status === "forbidden"
                ? "forbidden"
                : status === "no-key"
                  ? "no-key"
                  : "error",
          message,
        }}
        onSignedIn={reload}
      />
    );
  }

  const messages = data.messages;

  return (
    <div className="space-y-5">
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle hint="Scrisorile trimise prin formularul de contact.">
            Mesaje
          </SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {STATES.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setState(entry.key)}
                aria-pressed={state === entry.key}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors duration-300",
                  state === entry.key
                    ? "border-signal/45 bg-signal/12 text-signal-bright"
                    : "border-white/[0.08] bg-white/[0.03] text-ink-faint hover:border-white/20 hover:text-ink-muted",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {messages.length === 0 ? (
        <Panel className="p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-[14px] border border-white/10 bg-white/[0.03]">
            <Inbox className="size-5 text-ink-faint" aria-hidden />
          </span>
          <p className="mt-4 font-display text-[16px] font-semibold text-ink">
            Nimic aici
          </p>
          <p className="mt-1.5 text-[13px] text-ink-faint">
            {state === "archived"
              ? "Niciun mesaj arhivat."
              : "Niciun mesaj nou."}
          </p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {messages.map((message) => (
            <li key={message.id}>
              <MessageCard message={message} onChange={change} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MessageCard({
  message,
  onChange,
}: {
  message: Message;
  onChange: (id: string, patch: { read?: boolean; archived?: boolean }) => void;
}) {
  return (
    <Panel
      className={cn(
        "p-5 transition-colors duration-300",
        !message.read && !message.archived && "border-signal/25",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={cn(
            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border",
            message.read
              ? "border-white/10 bg-white/[0.03] text-ink-faint"
              : "border-signal/35 bg-signal/10 text-signal",
          )}
        >
          {message.read ? (
            <MailOpen className="size-4" aria-hidden />
          ) : (
            <Mail className="size-4" aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-[14px] font-medium text-ink">
              {message.name || message.email || "Vizitator"}
            </p>
            {message.email ? (
              <a
                href={`mailto:${message.email}`}
                className="truncate text-[12.5px] text-ink-faint transition-colors duration-300 hover:text-signal-bright"
              >
                {message.email}
              </a>
            ) : null}
            <span className="ml-auto shrink-0 text-[12px] text-ink-faint">
              {formatDateTime(message.created_at)}
            </span>
          </div>

          {message.subject ? (
            <p className="mt-1.5 text-[13.5px] text-signal-bright">
              {message.subject}
            </p>
          ) : null}

          <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-muted">
            {message.body}
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {message.page ? (
              <Pill tone="quiet">pagina: {message.page}</Pill>
            ) : null}
            {message.agent ? (
              <Pill tone="quiet">{message.agent}</Pill>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange(message.id, { read: !message.read })}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink"
            >
              {message.read ? "Marchează necitit" : "Marchează citit"}
            </button>
            <button
              type="button"
              onClick={() => onChange(message.id, { archived: !message.archived })}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-ink-muted transition-colors duration-300 hover:border-white/20 hover:text-ink"
            >
              {message.archived ? (
                <>
                  <ArchiveRestore className="size-3.5" aria-hidden />
                  Scoate din arhivă
                </>
              ) : (
                <>
                  <Archive className="size-3.5" aria-hidden />
                  Arhivează
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
