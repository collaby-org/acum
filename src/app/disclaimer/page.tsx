import type { Metadata } from "next";
import Link from "next/link";
import {
  LinkRow,
  Note,
  PageHero,
  PageSection,
  Prose,
} from "@/components/pages/blocks";
import { PageShell } from "@/components/pages/shell";
import { SITE_NAME, SITE_PROMISE_SHORT } from "@/lib/site";

/**
 * The disclaimer.
 *
 * What the site is not, in plain words: not a broadcaster, not a host of the
 * content, not a guarantee that anything works.
 */

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    `Disclaimerul ${SITE_NAME}: siteul este un director de canale TV live, nu găzduiește emisiunile și nu garantează funcționarea unui canal.`,
};

/** The version date. Bump it when the text changes. */
const VERSION = "22 octombrie 2026";

export default function Disclaimer() {
  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Legal"
          title="Disclaimer"
          lead={
            <>
              Un director de canale TV live, nu un post de televiziune. Pagina
              asta spune, fără nuanțe, ce nu este {SITE_NAME} și ce nu putem garanta.
            </>
          }
          meta={
            <>
              <span>Versiunea din {VERSION}</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>Se aplică utilizării site-ului</span>
            </>
          }
        />

        <PageSection className="py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-14">
            <Prose>
              <h2>1. Nu suntem un post de televiziune</h2>
              <p>
                {SITE_NAME} nu produce, nu achiziționează și nu difuzează conținut
                editorial. Nu realizăm emisiuni, nu avem contracte de difuzare cu
                canalele listate și nu avem niciun cuvânt de spus despre ce se
                difuzează pe ele.
              </p>

              <h2>2. Nu găzduim conținut</h2>
              <p>
                Catalogul reunește canale și adresele publice de încorporare pe
                care acestea le oferă. Fișierele video nu sunt servite de
                serverele noastre și nu sunt stocate în memoria lor. Playerul
                cere segmentul direct de la sursa canalului, printr-un proxy care
                ascunde adresa tehnică și nu reține conținutul.
              </p>

              <h2>3. Nu garantăm funcționarea</h2>
              <p>
                Un canal poate să nu mai emită, să își schimbe adresa, să fie
                indisponibil din cauza rețelei dintre tine și sursa lui sau să
                folosească un protocol pentru care nu există player de web. Lista
                de canale și starea fiecăruia sunt verificate la momentul
                construirii catalogului și se pot schimba de la un moment la
                altul.
              </p>

              <h2>4. Ghidul poate conține erori</h2>
              <p>
                Programul fiecărui canal este preluat dintr-un director public.
                Erorile de program — un show mutat, o emisiune anulată, o oră
                greșită — vin din sursă și se corectează acolo. {SITE_NAME} nu le
                corectează și nu le ascunde.
              </p>

              <h2>5. Măsurătorile noastre</h2>
              <p>
                Numărul de spectatori afișat pe site este măsurat de noi, la
                proxy, și se referă la browsere, nu la persoane distincte, și
                doar la ce se vede pe {SITE_NAME}. Contorul de popularitate preluat de la
                directoarele externe este un clasament cumulativ, nu o audiență.
                Niciunul nu este un clasament de audiență măsurată de un operator
                de telecablat, și niciunul nu este prezentat ca atare.
              </p>

              <h2>6. Clasamentele și voturile</h2>
              <p>
                Site-ul nu are, în acest moment, un sistem de vot. Clasamentele
                publicate sunt derivate din ghid și din măsurătoarea de
                spectatori, iar metoda este scrisă pe pagina fiecărui
                clasament.
              </p>

              <h2>7. Responsabilitatea ta</h2>
              <p>
                Folosești serviciul pe răspunderea ta. Respectă legislația care
                te se aplică și drepturile deținătorilor canalelor; în cazul în
                care o utilizare anumită este interzisă în țara sau situația ta,
                acea utilizare nu este susținută de {SITE_NAME}. Pentru detalii, vezi{" "}
                <Link href="/dmca" className="text-signal-bright underline underline-offset-4">
                  pagina de drepturi de autor
                </Link>{" "}
                și{" "}
                <Link href="/termeni" className="text-signal-bright underline underline-offset-4">
                  termenii
                </Link>
                .
              </p>

              <h2>8. Legături dincolo de {SITE_NAME}</h2>
              <p>
                Site-ul nu afișează reclame și nu plasează butoane care să te
                trimită în afara lui. Adresele pe care ți le dăm ca „unde se
                vede” un canal propus sunt adresele pe care ni le dai tu; nu
                le-am verifica și nu le asumăm.
              </p>
            </Prose>

            <div className="space-y-5">
              <Note title="Pe scurt">
                <ul className="space-y-2">
                  <li>Nu suntem un post de televiziune.</li>
                  <li>Nu găzduim conținut.</li>
                  <li>Nu garantăm că un canal merge.</li>
                  <li>Ghidul poate conține erori.</li>
                  <li>Măsurătorile noastre sunt despre browsere, nu despre oameni.</li>
                  <li>{SITE_PROMISE_SHORT}.</li>
                </ul>
              </Note>

              <Note title="Ceva nu se comportă cum trebuie?">
                <p>
                  Spune-ne prin{" "}
                  <Link href="/contact" className="text-signal-bright underline underline-offset-4">
                    contact
                  </Link>
                  . Mesajul ajunge în panoul echipei și este citit de oameni; nu
                  trimitem e-mailuri de pe site.
                </p>
              </Note>
            </div>
          </div>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Termeni și condiții", href: "/termeni" },
              { label: "DMCA și drepturi de autor", href: "/dmca" },
              { label: "Despre noi", href: "/despre" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
