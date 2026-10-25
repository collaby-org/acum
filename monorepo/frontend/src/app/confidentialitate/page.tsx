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
 * The privacy policy.
 *
 * It lists the data the site actually handles — which is not much — and
 * says plainly what it is not done with.
 */

export const metadata: Metadata = {
  title: "Politică de confidențialitate",
  description:
    `Politica de confidențialitate ${SITE_NAME}: ce date colectăm, de ce, cât timp le păstrăm și ce nu facem cu ele.`,
};

/** The version date. Bump it when the text changes. */
const VERSION = "22 octombrie 2026";

export default function Confidentialitate() {
  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Legal"
          title="Politică de confidențialitate"
          lead={
            <>
              Ce date atingem, de ce le atingem și cât timp le ținem. Textul
              acesta este scris ca o listă de fapte, nu ca o formulă.
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
              <h2>1. Principiul</h2>
              <p>
                Nu vindem date personale. Nu cumpărăm date personale. Nu
                afișăm reclame, deci nu există niciun partener care să urmărească
                ce faci pe site. Ce nu colectăm, nu avem ce pierde.
              </p>

              <h2>2. Ce colectăm</h2>
              <ul>
                <li>
                  <strong className="font-semibold text-ink">
                    Mesajele pe care ni le scrii.
                  </strong>{" "}
                  Numele, adresa de e-mail (dacă o completezi), subiectul,
                  textul mesajului, pagina de pe care l-ai trimis și
                  identificatorul browserului. Sunt păstrate cât timp este
                  necesar pentru a fi tratate, apoi sunt șterse.
                </li>
                <li>
                  <strong className="font-semibold text-ink">
                    Datele contului, dacă ai unul.
                  </strong>{" "}
                  Adresa de e-mail și numele afișat, plus ce contine istoricul
                  de activitate necesar funcționării contului.
                </li>
                <li>
                  <strong className="font-semibold text-ink">
                    Preferințele din browser.
                  </strong>{" "}
                  Favoritele și listele „mai târziu” sunt păstrate local, în
                  browserul tău. Nu sunt trimise la server și nu sunt
                  asociate cu tine.
                </li>
                <li>
                  <strong className="font-semibold text-ink">
                    O măsurătoare anonimă a spectatorilor.
                  </strong>{" "}
                  Pentru fiecare canal, numărul de browsere distincte care cer
                  un segment de la el în ultimele nouăzeci de secunde. Este un
                  număr, nu o identitate, și se șterge singur după o sută
                  optzeci de secunde.
                </li>
              </ul>

              <h2>3. Pentru ce le folosim</h2>
              <p>
                Doar pentru a face serviciul să funcționeze: să-ți livrăm
                catalogul și ghidul, să-ți păstrăm contul și favoritele, să
                răspundem la mesajele tale și să apărăm serviciul de abuzuri.
                Nu construim profiluri de publicitate și nu folosim datele tale
                pentru a decide ce anume îți aratăm.
              </p>

              <h2>4. Cine le mai poate vedea</h2>
              <p>
                Persoanele din echipa {SITE_NAME}, atunci când au nevoie să răspundă
                unei cereri sau să rezolve un incident tehnic. Furnizorii de
                infrastructură, care procesează datele ca să poată servea
                paginile — fără acces la conținutul mesajelor în afara
                situațiilor în care este strict necesar. Nimic nu se vinde și
                nu se trimite către terți pentru scopuri comerciale.
              </p>

              <h2>5. Cât timp le păstrăm</h2>
              <p>
                Mesajele: cât timp este necesar pentru a fi tratate și pentru a
                păstra un răspuns coerent, apoi sunt șterse. Conturile: cât timp
                există, dacă nu sunt șterse de tine. Măsurătoarea de spectatori:
                dispare de la sine în mai puțin de trei minute.
              </p>

              <h2>6. Drepturile tale</h2>
              <p>
                Poți cere să aflăm ce date avem despre tine, să le corectăm sau
                să le ștergem, și poți cere să-ți ștergem contul. Scrie-ne
                prin{" "}
                <Link href="/contact" className="text-signal-bright underline underline-offset-4">
                  contact
                </Link>{" "}
                — cererea este tratată de oameni, din panou.
              </p>

              <h2>7. Cookie-uri și memorare locală</h2>
              <p>
                Detaliile sunt în{" "}
                <Link href="/cookies" className="text-signal-bright underline underline-offset-4">
                  politica cookies
                </Link>
                .
              </p>

              <h2>8. Modificări</h2>
              <p>
                Politica poate fi actualizată. Data versiunii este scrisă deasupra
                paginii, iar modificările esențiale vor fi anunțate pe site.
              </p>
            </Prose>

            <div className="space-y-5">
              <Note title="Rezumat">
                <ul className="space-y-2">
                  <li>Nu vindem și nu cumpărăm date personale.</li>
                  <li>{SITE_PROMISE_SHORT} și nici urmărire publicitară.</li>
                  <li>Favoritele stau în browserul tău.</li>
                  <li>Măsurătoarea de spectatori e un număr, nu o identitate.</li>
                  <li>Mesajele sunt șterse după ce au fost tratate.</li>
                </ul>
              </Note>

              <Note title="Drepturile tale, pe scurt">
                <p>
                  Aflare, corectare, ștergere, portabilitate. Scrie-ne prin{" "}
                  <Link href="/contact" className="text-signal-bright underline underline-offset-4">
                    contact
                  </Link>{" "}
                  și cererea ajunge în panou.
                </p>
              </Note>
            </div>
          </div>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Politica cookies", href: "/cookies" },
              { label: "Termeni și condiții", href: "/termeni" },
              { label: "Contact", href: "/contact" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
