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
import { PLANS, SITE_NAME, SITE_PROMISE_SHORT } from "@/lib/site";

/**
 * The terms of use.
 *
 * Short, readable, and honest about what the service is: a directory with a
 * player, over content owned by somebody else.
 */

export const metadata: Metadata = {
  title: "Termeni și condiții",
  description:
    `Termenii și condițiile de utilizare a ${SITE_NAME}: ce este serviciul, ce nu este, și care sunt limitele tale și ale noastre.`,
};

/** The version date. Bump it when the text changes. */
const VERSION = "22 octombrie 2026";

export default function Termeni() {
  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Legal"
          title="Termeni și condiții"
          lead={
            <>
              Textul care spune ce este {SITE_NAME}, ce nu este și ce rămâne
              responsabilitatea fiecăruia. Fără limbaj de avocat: lucrurile
              simple, scrise simplu.
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
              <h2>1. Despre serviciu</h2>
              <p>
                {SITE_NAME} este un director de canale de televiziune live. Catalogul
                reunește canale publice, cu adresele de încorporare oferite de
                acestea, și le face accesibile printr-un player propriu. Pe
                lângă catalog, oferim un ghid de programe, afișează ce rulează
                în acel moment și măsurăm câte persoane se uită la fiecare
                canal, în rețeaua noastră.
              </p>
              <p>
                Nu găzduim, nu stocăm și nu retransmitem emisiunile canalelor.
                Emisiunile sunt transmise de deținătorii canalelor, prin
                infrastructura lor, prin adresele pe care le-au făcut publice.
              </p>

              <h2>2. Ce oferim</h2>
              <p>
                Catalogul, ghidul de programe și playerul sunt accesibile fără
                plată. Planul gratuit oferă{" "}
                {PLANS[0].blurb.replace(/\.$/, "").toLowerCase()};
                planurile plătite ridică limita, iar prețurile lor sunt afișate
                înainte de orice plată, cu taxele cuprinse. {SITE_PROMISE_SHORT}.
                Nu vindem și nu cumpărăm date despre modul în care folosești
                serviciul.
              </p>

              <h2>3. Ce nu oferim</h2>
              <p>
                Nu oferim garanția că un canal funcționează permanent. Un canal
                poate să nu mai emită, să-și schimbe adresa sau să fie
                indisponibil din cauza rețelei dintre tine și sursa lui. Nu
                oferim garanția că ghidul de programe este exact: ghidul este
                preluat dintr-un director public și poate conține erori, pe care
                le corectăm pe măsură ce sunt raportate.
              </p>

              <h2>4. Utilizarea acceptabilă</h2>
              <p>
                Poți folosi serviciul așa cum ai folosi un televizor: pentru
                tine. Nu este permis să revinzi traficul pe care ți-l oferim în
                masă, să extragi conținutul în masă, să îl redistribui sau să
                folosești catalogul pentru a construi un catalog concurent.
              </p>

              <h2>5. Drepturile de autor</h2>
              <p>
                Canalele, emisiunile, programele și mărcile lor aparțin
                deținătorilor lor. {SITE_NAME} nu deține drepturi asupra lor și nu
                acordă drepturi asupra lor. Vezi{" "}
                <Link href="/dmca" className="text-signal-bright underline underline-offset-4">
                  pagina de drepturi de autor
                </Link>{" "}
                pentru cum se tratează o sesizare.
              </p>

              <h2>6. Limitarea răspunderii</h2>
              <p>
                Serviciul este oferit „așa cum este”, fără garanții. Nu
                răspundem pentru indisponibilitatea unui canal, pentru
                inexactitatea ghidului, pentru calitatea sau conținutul
                emisiunilor, nici pentru daunele care ar putea rezulta din
                folosirea unui serviciu TV fără garanții. Nimic din aceste
                condiții nu limitează drepturile pe care le nu poate limita legea
                aplicabilă.
              </p>

              <h2>7. Date personale</h2>
              <p>
                Folosim datele tale doar pentru a face serviciul să funcționeze.
                Detaliile sunt în{" "}
                <Link
                  href="/confidentialitate"
                  className="text-signal-bright underline underline-offset-4"
                >
                  politica de confidențialitate
                </Link>{" "}
                și în{" "}
                <Link href="/cookies" className="text-signal-bright underline underline-offset-4">
                  politica cookies
                </Link>
                .
              </p>

              <h2>8. Modificări</h2>
              <p>
                Termenii se pot modifica. Versiunea afișată pe această pagină
                este cea care se aplică; data ei este scrisă deasupra. Modificările
                esențiale vor fi anunțate pe site.
              </p>

              <h2>9. Contact</h2>
              <p>
                Pentru orice întrebare despre acești termeni, scrie-ne prin{" "}
                <Link href="/contact" className="text-signal-bright underline underline-offset-4">
                  contact
                </Link>
                . Mesajul ajunge în panoul echipei și este citit de oameni; de
                aceea nu trimitem e-mailuri de pe site.
              </p>
            </Prose>

            <div className="space-y-5">
              <Note title="Pe scurt">
                <ul className="space-y-2">
                  <li>Accesul la catalog și la ghid este gratuit.</li>
                  <li>{SITE_PROMISE_SHORT}.</li>
                  <li>Nu găzduim conținut: doar indexăm adresele publice.</li>
                  <li>Nu vindem date despre tine.</li>
                  <li>Ghidul poate conține erori și le corectăm.</li>
                  <li>Nu trimitem e-mailuri.</li>
                </ul>
              </Note>

              <Note title="Documente conexe">
                <ul className="space-y-2">
                  <li>
                    <Link
                      href="/confidentialitate"
                      className="text-signal-bright underline underline-offset-4"
                    >
                      Politica de confidențialitate
                    </Link>
                  </li>
                  <li>
                    <Link href="/cookies" className="text-signal-bright underline underline-offset-4">
                      Politica cookies
                    </Link>
                  </li>
                  <li>
                    <Link href="/dmca" className="text-signal-bright underline underline-offset-4">
                      DMCA și drepturi de autor
                    </Link>
                  </li>
                  <li>
                    <Link href="/disclaimer" className="text-signal-bright underline underline-offset-4">
                      Disclaimer
                    </Link>
                  </li>
                </ul>
              </Note>
            </div>
          </div>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Contact", href: "/contact" },
              { label: "Întrebări frecvente", href: "/intrebari" },
              { label: "Despre noi", href: "/despre" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
