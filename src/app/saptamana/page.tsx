import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

export const dynamic = "force-dynamic";


import {
  LinkRow,
  Note,
  PageHero,
  PageSection,
  Stat,
} from "@/components/pages/blocks";
import { PageShell } from "@/components/pages/shell";
import { formatClock } from "@/components/now-next";
import {
  bucharestDay,
  dayHighlights,
  dayLabel,
  getGuide,
  guideDays,
  requestMoment,
  shiftDay,
  weekdayLabel,
} from "@/lib/guide-pages";
import { SITE_NAME } from "@/lib/site";

/**
 * The week.
 *
 * The guide publishes one rolling day, so most of the week is not in the
 * file. The page says which days it has and which it does not, and shows
 * the days it has — it never fills the missing days with today's
 * programmes.
 */


export const metadata: Metadata = {
  title: "Programul săptămânii",
  description:
    `Programul TV al săptămânii, zi cu zi. Ghidul ${SITE_NAME} arată exact zilele publicate și pe cele care nu sunt încă.`,
};

export default async function Saptamana() {
  // connection() omitted for static export

  const now = requestMoment();
  const guide = await getGuide();

  const today = bucharestDay(now);
  const days = guideDays(guide, now);
  const covered = new Map(days.map((day) => [day.date, day]));

  // The seven days of the week, starting today.
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDay(today, index);
    return {
      date,
      index,
      day: covered.get(date) ?? null,
      label: dayLabel(date),
      weekday: weekdayLabel(date),
    };
  });

  const coveredCount = week.filter((entry) => entry.day).length;
  const published = week.filter((entry) => entry.day);

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Program TV · săptămâna"
          title="Programul săptămânii"
          lead={
            <>
              Ghidul de programe publică o singură zi care se rotește, iar
              zilele următoare apar în fișier doar cu câteva ore înainte. Pagina
              arată{" "}
              <strong className="font-semibold text-ink">
                {coveredCount} din 7 zile
              </strong>{" "}
              — și spune explicit care nu sunt publicate încă.
            </>
          }
          meta={
            <>
              <span>Săptămâna începe {week[0]?.label}</span>
              {days.length > 0 ? (
                <>
                  <span aria-hidden className="text-ink-faint/50">
                    ·
                  </span>
                  <span>Ghidul conține {days.length} zile calendaristice</span>
                </>
              ) : null}
            </>
          }
        >
          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Zile publicate" value={`${coveredCount} / 7`} />
            <Stat
              label="Zile în ghid"
              value={days.length}
              hint="Zile calendaristice distincte."
            />
            <Stat
              label="Emisiuni în ghid"
              value={days.reduce((sum, day) => sum + day.programmes, 0)}
            />
            <Stat
              label="Canale acoperite"
              value={days[0]?.channels ?? 0}
              hint="În prima zi publicată."
            />
          </div>
        </PageHero>

        <PageSection className="py-12 sm:py-16">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {week.map((entry) => {
              const has = entry.day !== null;
              return (
                <div
                  key={entry.date}
                  className={
                    has
                      ? "relative overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.08] bg-white/[0.035] p-5"
                      : "relative overflow-hidden rounded-[var(--radius-panel)] border border-dashed border-white/[0.12] bg-white/[0.015] p-5"
                  }
                >
                  {has ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 -z-10 mix-blend-screen"
                      style={{
                        background:
                          "radial-gradient(70% 70% at 0% 0%, hsl(38 92% 52% / 0.16) 0%, transparent 62%)",
                      }}
                    />
                  ) : null}

                  <p
                    className={
                      has
                        ? "text-[11px] font-semibold uppercase tracking-[0.2em] text-signal/85"
                        : "text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint/70"
                    }
                  >
                    {entry.weekday}
                  </p>
                  <p className="mt-1.5 font-display text-[17px] font-semibold tracking-tight text-ink">
                    {entry.label.replace(/^[^,]+,\s*/, "")}
                  </p>

                  {entry.day ? (
                    <>
                      <p className="mt-2.5 font-mono text-[11.5px] tabular-nums text-ink-faint">
                        {formatClock(entry.day.first)} — {formatClock(entry.day.last)}
                      </p>
                      <p className="mt-1 text-[12px] text-ink-muted">
                        {entry.day.programmes} emisiuni · {entry.day.channels}{" "}
                        canale
                      </p>
                      <Link
                        href={`/ghid?zi=${entry.date}`}
                        className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-signal-bright transition-colors duration-300 hover:text-signal"
                      >
                        Vezi ziua în ghid
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
                        Programul zilei nu este publicat încă.
                      </p>
                      <p className="mt-1 text-[11.5px] text-ink-faint/70">
                        Se publică cu câteva ore înainte.
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </PageSection>

        {published.length > 0 ? (
          <PageSection
            className="pb-12 sm:pb-16"
            eyebrow="Ce se vede cel mai mult"
            title="Programele difuzate pe cele mai multe canale"
            lead="În fiecare zi publicată, titlurile pe care le difuzează cele mai multe canale. Un titlu pe mai multe canale înseamnă, de obicei, că se vede în toată țara."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {published.map((entry) => {
                const highlights = entry.day
                  ? dayHighlights(guide, entry.date)
                  : [];
                return (
                  <div
                    key={entry.date}
                    className="rounded-[var(--radius-panel)] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-display text-[15px] font-semibold tracking-tight text-ink">
                        {entry.label}
                      </h3>
                      <Link
                        href={`/ghid?zi=${entry.date}`}
                        className="text-[11.5px] uppercase tracking-[0.12em] text-ink-faint transition-colors duration-300 hover:text-ink"
                      >
                        Ghid
                      </Link>
                    </div>

                    {highlights.length === 0 ? (
                      <p className="mt-4 text-[13px] leading-relaxed text-ink-faint">
                        În această zi nu există un titlu difuzat pe mai multe
                        canale. Fiecare emisiune apare pe un singur canal.
                      </p>
                    ) : (
                      <ol className="mt-4 space-y-3">
                        {highlights.map((highlight, index) => (
                          <li
                            key={highlight.title}
                            className="flex gap-3 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0"
                          >
                            <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13.5px] text-ink">
                                {highlight.title}
                              </p>
                              <p className="mt-0.5 truncate text-[11.5px] text-ink-faint">
                                pe {highlight.channels.length} canale ·{" "}
                                {highlight.channels.slice(0, 4).join(", ")}
                                {highlight.channels.length > 4
                                  ? ` +${highlight.channels.length - 4}`
                                  : ""}
                              </p>
                            </div>
                            {highlight.onNow ? (
                              <span className="shrink-0 self-start rounded-full bg-live/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-live-soft">
                                Acum
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
            </div>
          </PageSection>
        ) : (
          <PageSection className="pb-12 sm:pb-16">
            <Note title="Ghidul nu are zile publicate" tone="signal">
              Fișierul ghidului nu conține niciun program pentru nicio zi. Pagina
              se reîncarcă la fiecare cerere, deci următoarea vizitare vede starea
              nouă.
            </Note>
          </PageSection>
        )}

        <PageSection className="pb-16 sm:pb-20">
          <Note title="De ce nu arătăm o săptămână întreagă">
            <p>
              Ar fi fals. Ghidul este generat dintr-o singură zi care se rotește
              și, în plus, primele ore ale zilei următoare. Dacă am completa
              zilele lipsă cu programul de azi, ai vedea o săptămână care nu
              există — și tocmai acea pagină ar trebui să spună adevărul.
            </p>
            <p className="mt-3">
              Ce acoperă ghidul în acest moment se vede, în schimb, pe{" "}
              <Link href="/ghid" className="text-signal-bright underline underline-offset-4">
                pagina ghidului interactiv
              </Link>
              .
            </p>
          </Note>
          <LinkRow
            className="mt-6"
            label="Mergi mai departe"
            links={[
              { label: "Ce rulează acum", href: "/azi" },
              { label: "Program de mâine", href: "/maine" },
              { label: "Ghid TV interactiv", href: "/ghid" },
              { label: "Meciuri live la TV", href: "/meciuri" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
