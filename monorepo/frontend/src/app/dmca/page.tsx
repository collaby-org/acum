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
import { SITE_NAME } from "@/lib/site";

/**
 * DMCA and copyright.
 *
 * The product indexes public embed addresses; it does not host the broadcast.
 * The page states that plainly and says what happens when a rights holder
 * makes a claim.
 */

export const metadata: Metadata = {
  title: "DMCA și drepturi de autor",
  description:
    `Cum tratează ${SITE_NAME} drepturile de autor: faptul că nu găzduim emisiunile, cum se îndepărtează un canal și unde se trimit sesizările.`,
};

/** The version date. Bump it when the text changes. */
const VERSION = "22 octombrie 2026";

export default function Dmca() {
  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Legal"
          title="DMCA și drepturi de autor"
          lead={
            <>
              {SITE_NAME} nu găzduiește și nu retransmite emisiunile. Indexează adresele
              publice pe care canalele le oferă pentru încorporare și le
              verifică. Drepturile asupra conținutului rămân ale deținătorilor
              canalelor.
            </>
          }
          meta={
            <>
              <span>Versiunea din {VERSION}</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>Adresă de sesizări în panoul echipei</span>
            </>
          }
        />

        <PageSection className="py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-14">
            <Prose>
              <h2>1. Ce este {SITE_NAME}</h2>
              <p>
                {SITE_NAME} este un director. Catalogul reunește canale TV live publice
                și adresele de încorporare pe care acestea le publică. Nu
                găzduim fișierele video, nu memorăm fluxurile și nu le
                retransmitem prin serverele noastre: playerul de pe site trimite
                cererea direct către sursa canalului, prin intermediul unui
                proxy care ascunde adresa tehnică.
              </p>
              <p>
                Conținutul — emisiunile, programele, mărcile, imaginile,
                muzica — aparțin deținătorilor canalelor și de celor care au
                drepturi asupra lor. {SITE_NAME} nu deține drepturi asupra conținutului
                și nu acordă licențe în numele nimănui.
              </p>

              <h2>2. Cât de corect este catalogul</h2>
              <p>
                Fiecare canal este verificat automat, iar rezultatul verificării
                este afișat. Nu verificăm drepturile de difuzare ale fiecărui
                canal în toate piețele în care poate fi vizionat; verificăm că
                adresa este publică și funcționează.
              </p>

              <h2>3. Sesizări de la deținătorii de drepturi</h2>
              <p>
                Dacă ești deținătorul drepturilor pentru un canal și vrei ca
                acesta să fie îndepărtat din catalog, scrie-ne prin{" "}
                <Link href="/contact" className="text-signal-bright underline underline-offset-4">
                  contact
                </Link>{" "}
                cu:
              </p>
              <ul>
                <li>numele canalului și adresa unde este vizibil acum;</li>
                <li>
                  o descriere a materialului pentru care ai drepturi și a
                  temeiului în care îl folosești;
                </li>
                <li>
                  datele tale de contact și o confirmare că ești îndreptățit să
                  ceri îndepărtarea;
                </li>
                <li>
                  o adresă sau o semnătură care să ne ajută să identificăm
                  canalul în catalog.
                </li>
              </ul>
              <p>
                Sesizările sunt tratate de oameni, în panoul echipei. Nu
                trimitem e-mailuri de pe site — de aceea, în formular, adresa de
                e-mail este opțională, iar răspunsul vine prin canalul pe care
                l-ai folosit.
              </p>

              <h2>4. Ce facem când primim o sesizare</h2>
              <ol>
                <li>
                  Verificăm dacă sesizarea identifică un canal din catalog și
                  dacă dovedește deținerea drepturilor.
                </li>
                <li>
                  Dacă da, canalul este scos din catalog la următoarea
                  reconstruire a datelor și nu mai apare nici în listele
                  publice.
                </li>
                <li>
                  Dacă nu, răspundem prin același canal, cu motivele.
                </li>
              </ol>

              <h2>5. Contestații</h2>
              <p>
                Dacă o sesizare a fost greșită sau a fost retrimisă de două ori
                de aceeași parte, spune-ne prin același formular. Le citim și le
                revedem.
              </p>

              <h2>6. Numele și mărcile</h2>
              <p>
                Numele și siglele canalelor apar în catalog pentru a identifica
                fiecare canal și aparțin deținătorilor lor. Folosirea lor într-un
                director nu creează niciun drept și nicio obligație.
              </p>
            </Prose>

            <div className="space-y-5">
              <Note title="Pe scurt">
                <ul className="space-y-2">
                  <li>Nu găzduim și nu retransmitem emisiunile.</li>
                  <li>Indexăm adrese publice și le verificăm.</li>
                  <li>Conținutul aparține deținătorilor canalelor.</li>
                  <li>Cererile de îndepărtare sunt tratate de oameni.</li>
                  <li>Nu trimitem e-mailuri.</li>
                </ul>
              </Note>

              <Note title="Unde trimiți o sesizare">
                <p>
                  Prin{" "}
                  <Link href="/contact" className="text-signal-bright underline underline-offset-4">
                    pagina de contact
                  </Link>
                  , marcând subiectul ca fiind despre drepturi de autor.
                  Mesajul ajunge în panoul echipei, unde este citit.
                </p>
              </Note>
            </div>
          </div>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Disclaimer", href: "/disclaimer" },
              { label: "Termeni și condiții", href: "/termeni" },
              { label: "Contact", href: "/contact" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
