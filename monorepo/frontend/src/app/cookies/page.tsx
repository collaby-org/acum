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
 * The cookie policy.
 *
 * The site has no advertising and no third-party trackers, so the list of
 * cookies is short and the point of the page is that there is nothing to
 * consent to.
 */

export const metadata: Metadata = {
  title: "Politică cookies",
  description:
    `Politica cookies ${SITE_NAME}: ce se păstrează în browser, de ce, și de ce nu există reclame care să urmărească.`,
};

/** The version date. Bump it when the text changes. */
const VERSION = "22 octombrie 2026";

export default function Cookies() {
  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Legal"
          title="Politică cookies"
          lead={
            <>
              {SITE_NAME} nu are reclame, deci nu are pixeli de urmărire, nici
              consimțămint banner, nici butoane de „acceptă tot”. Ce rămâne în
              browserul tău este local și poate fi șters oricând.
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
              <h2>1. Ce sunt cookie-urile</h2>
              <p>
                Cookie-urile sunt mici fișiere text pe care site-ul le poate cere
                browserului tău să le păstreze. Unele sunt obligatorii pentru ca
                pagina să funcționeze; altele pot fi folosite pentru a te
                urmări între vizite.
              </p>

              <h2>2. Ce folosește {SITE_NAME}</h2>
              <ul>
                <li>
                  <strong className="font-semibold text-ink">
                    Memorare locală, în browser.
                  </strong>{" "}
                  Favoritele, listele „mai târziu” și istoricul vizionatelor
                  sunt păstrate în browserul tău, sub chei locali ai aplicației.
                  Nu sunt trimise serverului și nu sunt asociate cu un cont,
                  dacă nu ai unul.
                </li>
                <li>
                  <strong className="font-semibold text-ink">
                    Cache-ul aplicației.
                  </strong>{" "}
                  Pentru ca paginile să se încarce repede, aplicația memorează
                  local fișierele proprii și un identificator de sesiune
                  folosit la numărarea spectatorilor. Acesta este un număr
                  aleator, fără legătură cu tine.
                </li>
                <li>
                  <strong className="font-semibold text-ink">
                    Service worker.
                  </strong>{" "}
                  Pentru funcționarea offline și pentru actualizarea aplicației
                  pe telefon.
                </li>
              </ul>

              <h2>3. Ce nu folosește {SITE_NAME}</h2>
              <p>
                Niciun cookie de publicitate, niciunul de urmărire între site-uri,
                niciun instrument de analiză de la terți, niciun pixel de
                reclamă, niciun buton de partajare care să transmită ceva. Nu
                există consimțăminț banner, pentru că nu există nimic de
                consimțit: datele de mai sus nu te urmăresc și nu te identifică.
              </p>

              <h2>4. Cum le ștergi</h2>
              <p>
                Poți șterge datele site-ului din setările browserului, la
                „Date de site” sau „Storage”. Ștergerea lor înseamnă doar că
                favoritele și listele tale se pierd și că aplicația va fi
                descărcată din nou. Dacă ai un cont {SITE_NAME}, aceleași informații
                rămân în cont, pe server.
              </p>

              <h2>5. Un cuvânt despre do-not-track</h2>
              <p>
                Nu folosim urmărirea nici cu ajutorul semnalului
                „Do Not Track”. Nu pentru că ar fi elegant, ci pentru că nu
                există nimic de urmărit.
              </p>
            </Prose>

            <div className="space-y-5">
              <Note title="Rezumat">
                <ul className="space-y-2">
                  <li>{SITE_PROMISE_SHORT}, deci fără pixeli de urmărire.</li>
                  <li>Fără instrumente de analiză de la terți.</li>
                  <li>Fără consimțăminț banner.</li>
                  <li>Datele locale sunt șterse din browser când vrei.</li>
                </ul>
              </Note>

              <Note title="Mai mult">
                <p>
                  Cum sunt tratate datele tale în general:{" "}
                  <Link
                    href="/confidentialitate"
                    className="text-signal-bright underline underline-offset-4"
                  >
                    politica de confidențialitate
                  </Link>
                  .
                </p>
              </Note>
            </div>
          </div>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Politica de confidențialitate", href: "/confidentialitate" },
              { label: "Termeni și condiții", href: "/termeni" },
              { label: "Contact", href: "/contact" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
