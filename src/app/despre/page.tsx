import type { Metadata } from "next";
import Link from "next/link";
import {
  LinkRow,
  Note,
  PageHero,
  PageSection,
  Stat,
} from "@/components/pages/blocks";
import { CHANNELS } from "@/data/channels";
import { PageShell } from "@/components/pages/shell";
import { PLANS, SITE_NAME, SITE_PROMISE_SHORT } from "@/lib/site";

/**
 * About.
 *
 * The page says what the product is, how the catalogue is made and — just
 * as important — what it is not.
 */

export const metadata: Metadata = {
  title: "Despre noi",
  description:
    `Ce este ${SITE_NAME}: un director de canale TV live românești, cu player propriu, ghid de programe și ${SITE_PROMISE_SHORT.toLowerCase()}.`,
};

export default function Despre() {
  const total = CHANNELS.length;
  const live = CHANNELS.filter((channel) => channel.status === "live").length;

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Despre noi"
          title="Un director de televiziune, făcut să funcționeze"
          lead={
            <>
              {SITE_NAME} aduce canalele live românești într-un singur loc, cu un player
              care chiar pornește, cu ghid de programe și {SITE_PROMISE_SHORT.toLowerCase()}.
              Nu este o copie a nimănui: este o interfață construită pentru un lucru
              simplu — să apeși pe un canal și să-l vezi.
            </>
          }
        >
          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Canale" value={total} />
            <Stat label="Verificate acum" value={live} />
            <Stat label="Reclame" value="zero" />
            <Stat
              label="Verificare"
              value="automată"
              hint="Fiecare canal, unul cu unul."
            />
          </div>
        </PageHero>

        <PageSection className="py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
            <div className="max-w-2xl space-y-6 text-[15px] leading-[1.75] text-ink-muted">
              <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
                Ce facem
              </h2>
              <p>
                {SITE_NAME} nu este un motor de căutare și nici o platformă de streaming
                cu conținut propriu. Este un <strong>director</strong>: un
                catalog de canale live, verificat, cu un player propriu și cu
                informația despre ce rulează acum.
              </p>
              <p>
                Fiecare canal din catalog este trecut printr-o verificare
                automată, iar rezultatul — funcționează sau nu, la ce calitate,
                de câte ori a fost verificat — este afișat alături de el. Un
                canal care nu răspunde rămâne în listă, marcat ca indisponibil.
                Nu ascundem nimic și nu umplăm locul gol cu alte canale.
              </p>

              <h2 className="mt-10 font-display text-xl font-semibold tracking-tight text-ink">
                Ghidul de programe
              </h2>
              <p>
                Ghidul este produs în afara aplicației, dintr-un director public
                de programe, și este citit la fiecare cerere. Acoperă o zi care se
                rotește și primele ore ale zilei următoare. Nu îl completăm cu
                date invocate: când o zi nu este publicată, pagina spune că nu
                este publicată.
              </p>

              <h2 className="mt-10 font-display text-xl font-semibold tracking-tight text-ink">
                Cele două numere
              </h2>
              <p>
                {SITE_NAME} măsoară singur câte browsere se uită la fiecare canal, la
                proxy-ul propriu. Este o măsurătoare aici, în acest moment, și se
                mișcă în timp real. Separat, directoarele de la care indexăm
                canalele publică un contor de popularitate — un clasament
                cumulativ, nu o audiență. Cele două nu sunt amestecate niciodată
                și niciunul nu este prezentat ca celălalt.
              </p>

              <h2 className="mt-10 font-display text-xl font-semibold tracking-tight text-ink">
                Contul și planurile
              </h2>
              <p>
                Există un cont, și este gratuit:{" "}
                {PLANS[0].blurb.replace(/\.$/, "").toLowerCase()}. El ține
                favoritele și istoricul pe mai multe dispozitive. Planurile
                plătite —{" "}
                {PLANS.filter((plan) => plan.price !== null)
                  .map((plan) => plan.name.toLowerCase())
                  .join(", ")}{" "}
                — ridică limita de vizionare. Prețurile și ce cuprinde fiecare
                plan sunt pe{" "}
                <Link href="/preturi" className="text-signal-bright underline underline-offset-4">
                  pagina cu planurile
                </Link>
                , afișate înainte de orice plată.
              </p>

              <h2 className="mt-10 font-display text-xl font-semibold tracking-tight text-ink">
                Ce nu facem
              </h2>
              <ul>
                <li>
                  Nu găzduim și nu retransmitem emisiunile. Canalele și
                  conținutul aparțin deținătorilor lor.
                </li>
                <li>
                  Nu punem reclame. Nu ascundem nimic în spatele unui buton de
                  „continuă”.
                </li>
                <li>
                  Nu vindem și nu cumpărăm date despre ce te uită.
                </li>
                <li>
                  Nu pretindem că ghidul este perfect. Erorile de program vin din
                  sursă și le corectăm pe măsură ce sunt raportate.
                </li>
              </ul>

              <h2 className="mt-10 font-display text-xl font-semibold tracking-tight text-ink">
                Cine suntem
              </h2>
              <p>
                O echipă mică, care crede că un director de canale TV poate fi
                util făcut bine: rapid, {SITE_PROMISE_SHORT.toLowerCase()}, cu informația corectă
                despre ce rulează. Scriem-ne — mesajele ajung în panou, unde
                sunt citite de oameni, nu într-o căsuță de e-mail.
              </p>
            </div>

            <div className="space-y-5">
              <Note title="Pe scurt">
                <ul className="space-y-2">
                  <li>
                    <strong className="font-semibold text-ink">Ce este:</strong>{" "}
                    un director de canale TV live, cu player și ghid de programe.
                  </li>
                  <li>
                    <strong className="font-semibold text-ink">Ce nu este:</strong>{" "}
                    o platformă de conținut propriu și nici un serviciu cu reclame.
                  </li>
                  <li>
                    <strong className="font-semibold text-ink">Reclame:</strong>{" "}
                    deloc, pe nicio pagină.
                  </li>
                  <li>
                    <strong className="font-semibold text-ink">Cont:</strong>{" "}
                    există și este gratuit —{" "}
                    {PLANS[0].blurb.replace(/\.$/, "").toLowerCase()}.
                  </li>
                  <li>
                    <strong className="font-semibold text-ink">Date despre tine:{" "}
                    </strong>
                    nu le vindem și nu le cumpărăm.
                  </li>
                  <li>
                    <strong className="font-semibold text-ink">E-mail:</strong>{" "}
                    nu trimitem.
                  </li>
                </ul>
              </Note>

              <Note title="Pagini utile">
                <ul className="space-y-2">
                  <li>
                    <Link href="/ghid-tv" className="text-signal-bright underline underline-offset-4">
                      Cum se folosește ghidul TV
                    </Link>
                  </li>
                  <li>
                    <Link href="/intrebari" className="text-signal-bright underline underline-offset-4">
                      Întrebări frecvente
                    </Link>
                  </li>
                  <li>
                    <Link href="/canale/grupate" className="text-signal-bright underline underline-offset-4">
                      Toate canalele
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="text-signal-bright underline underline-offset-4">
                      Contact
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
              { label: "Ghid TV interactiv", href: "/ghid" },
              { label: "Ce rulează acum", href: "/azi" },
              { label: "TV pentru diaspora", href: "/diaspora" },
              { label: "Termeni și condiții", href: "/termeni" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
