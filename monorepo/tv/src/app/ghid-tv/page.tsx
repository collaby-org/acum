import type { Metadata } from "next";
import Link from "next/link";
import {
  Contents,
  LinkRow,
  Note,
  PageHero,
  PageSection,
} from "@/components/pages/blocks";
import { PageShell } from "@/components/pages/shell";
import { SITE_NAME } from "@/lib/site";

/**
 * How to use the guide.
 *
 * The guide is the part of the product that needs explaining, so the
 * explanation says exactly what it covers and where it stops.
 */

export const metadata: Metadata = {
  title: "Ghid TV",
  description:
    `Cum se folosește ghidul TV al ${SITE_NAME}: ce acoperă, cum citești ce rulează acum și ce se întâmplă când o zi nu este publicată.`,
};

export default function GhidTv() {
  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Ghid TV"
          title="Cum se folosește ghidul"
          lead={
            <>
              Ghidul arată ce rulează pe fiecare canal, în timp real. Ține cont de
              două lucruri: se citește de la un director public, deci uneori are
              erori, și acoperă o singură zi care se rotește.
            </>
          }
        />

        <PageSection className="py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
            <div className="max-w-2xl">
              <Contents
                items={[
                  { label: "Ce este ghidul", href: "#ce-este" },
                  { label: "Cât acoperă", href: "#acoperire" },
                  { label: "Cum citești pagina de azi", href: "#azi" },
                  { label: "Ghidul interactiv", href: "#interactiv" },
                  { label: "Căutarea unei emisiuni", href: "#cautare" },
                  { label: "Meciurile", href: "#meciuri" },
                  { label: "Când ghidul greșește", href: "#erori" },
                ]}
              />

              <h2
                id="ce-este"
                className="mt-12 scroll-mt-28 font-display text-xl font-semibold tracking-tight text-ink"
              >
                Ce este ghidul
              </h2>
              <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">
                Ghidul este o listă publică de programe, citită de la un director
                de EPG. Pentru fiecare canal știm titlul emisiunii, ora de
                început și ora de sfârșit, ora în ora României. Nu este o
                sursă proprie: informația vine de la cel care o publică, cu
                erorile lui.
              </p>
              <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">
                {SITE_NAME} nu corectează titlurile și nu adaugă emisiuni de memorie.
                Un titlu greșit în ghid rămâne greșit până când sursa îl
                corectează — și până atunci ne este datorie să ți-l arătăm așa
                cum este.
              </p>

              <h2
                id="acoperire"
                className="mt-12 scroll-mt-28 font-display text-xl font-semibold tracking-tight text-ink"
              >
                Cât acoperă
              </h2>
              <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">
                O zi care se rotește. Practic, asta înseamnă:
              </p>
              <ul className="mt-4 space-y-2 pl-5 text-[15px] leading-[1.75] text-ink-muted">
                <li>
                  <strong className="font-semibold text-ink">Azi</strong> este
                  acoperit complet, de la primul la ultimul program al zilei.
                </li>
                <li>
                  <strong className="font-semibold text-ink">Mâine</strong> este
                  acoperit doar pentru primele ore, cu cât se apropie de miezul
                  nopții. Pagina{" "}
                  <Link href="/maine" className="text-signal-bright underline underline-offset-4">
                    de mâine
                  </Link>{" "}
                  spune exact până la ce oră.
                </li>
                <li>
                  <strong className="font-semibold text-ink">Săptămâna</strong>{" "}
                  nu este publicată. Pagina{" "}
                  <Link href="/saptamana" className="text-signal-bright underline underline-offset-4">
                    programului săptămânii
                  </Link>{" "}
                  arată zilele care există și le marchează pe cele care nu.
                </li>
                <li>
                  Nu toate canalele din catalog au program. Cele fără ghid
                  rămân în listă și rămân deschizabile.
                </li>
              </ul>

              <h2
                id="azi"
                className="mt-12 scroll-mt-28 font-display text-xl font-semibold tracking-tight text-ink"
              >
                Cum citești pagina de azi
              </h2>
              <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">
                Pe pagina{" "}
                <Link href="/azi" className="text-signal-bright underline underline-offset-4">
                  «Ce rulează acum»
                </Link>{" "}
                fiecare canal are un rând: numele, emisiunea din acest moment cu
                orele ei, o bară care arată cât a trecut din emisiune, și
                următoarele trei care urmează. Rândul este un link — duce la
                pagina canalului, unde se află playerul.
              </p>
              <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">
                Sub listă, un cronometru cu tot ce începe în următoarele trei
                ore, pe toate canalele deodată.
              </p>

              <h2
                id="interactiv"
                className="mt-12 scroll-mt-28 font-display text-xl font-semibold tracking-tight text-ink"
              >
                Ghidul interactiv
              </h2>
              <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">
                Pe pagina{" "}
                <Link href="/ghid" className="text-signal-bright underline underline-offset-4">
                  ghidului interactiv
                </Link>{" "}
                alegi un canal din stânga și vezi programul lui, zi cu zi. Poți
                filtra canalele după nume, iar ziua aleasă se poate schimba
                dacă ghidul conține mai multe zile.
              </p>
              <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">
                Adresa paginii se schimbă odată cu alegerea:{" "}
                <span className="font-mono text-[13px] text-ink">
                  /ghid?canal=digi-sport-1&amp;zi=2026-10-22
                </span>
                . Poți trimite un link exact către programul unui canal.
              </p>

              <h2
                id="cautare"
                className="mt-12 scroll-mt-28 font-display text-xl font-semibold tracking-tight text-ink"
              >
                Căutarea unei emisiuni
              </h2>
              <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">
                Pe pagina{" "}
                <Link
                  href="/cauta-o-emisiune"
                  className="text-signal-bright underline underline-offset-4"
                >
                  «Caută o emisiune»
                </Link>{" "}
                scrii primele litere și vezi toate aparițiile din ghid, grupate pe
                zile. Diacriticele nu contează: „stiinta” găsește și „Ştiinţa”.
                Fiecare rezultat duce la canalul pe care rulează emisiunea.
              </p>

              <h2
                id="meciuri"
                className="mt-12 scroll-mt-28 font-display text-xl font-semibold tracking-tight text-ink"
              >
                Meciurile
              </h2>
              <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">
                Pagina{" "}
                <Link href="/meciuri" className="text-signal-bright underline underline-offset-4">
                  meciurilor live
                </Link>{" "}
                recunoaște meciurile după titlu, pentru că ghidul nu are o
                secțiune de sport: când titlul numește două echipe separate
                printr-o linie de fracție, pe un canal de sport, este meci. Echipele
                se citesc înainte și după linie, iar runda de la final este
                scoasă înainte de împărțire.
              </p>
              <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">
                Competițiile care nu au două echipe în titlu — un turneu, o
                sesiune de tenis — apar mai jos, separat, ca transmisii live.
              </p>

              <h2
                id="erori"
                className="mt-12 scroll-mt-28 font-display text-xl font-semibold tracking-tight text-ink"
              >
                Când ghidul greșește
              </h2>
              <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">
                Greșește. Se întâmplă: un canal își schimbă programul în ultima
                oră, o emisiune este mutată sau anulată, iar directorul public
                actualizează mai târziu. Nu corectăm titlurile și nu le
                reinterpretăm.
              </p>
              <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">
                Dacă vezi o greșeală care ne-a scăpat, spune-ne — și o
                corectăm la sursă, pentru toată lumea.
              </p>
            </div>

            <div className="space-y-5">
              <Note title="O singură regulă">
                <p>
                  Nu arătăm niciodată un program pe care nu îl avem. Dacă o zi
                  nu este publicată, pagina spune că nu este publicată. E mai
                  puțin spectaculos decât o săptămână completă, dar este adevărat.
                </p>
              </Note>

              <Note title="Orele">
                <p>
                  Toate orele din ghid sunt ora României, indiferent de unde te
                  afli. Ora de vară este tratată corect, iar când se schimbă
                  ora, ghidul urmează automat.
                </p>
              </Note>

              <Note title="Ce nu este ghidul">
                <p>
                  Nu este un clasament de audiență, nu este un program complet pe
                  o săptămână și nu este un sistem de voturi. Ce este: ce s-a
                  publicat, citit la momentul deschiderii paginii.
                </p>
              </Note>
            </div>
          </div>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Ghid TV interactiv", href: "/ghid" },
              { label: "Ce rulează acum", href: "/azi" },
              { label: "Program de mâine", href: "/maine" },
              { label: "Caută o emisiune", href: "/cauta-o-emisiune" },
              { label: "Meciuri live la TV", href: "/meciuri" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
