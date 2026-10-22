import type { Metadata } from "next";
import Link from "next/link";
import {
  LinkRow,
  Note,
  PageHero,
  PageSection,
} from "@/components/pages/blocks";
import { MessageForm } from "@/components/pages/message-form";
import { PageShell } from "@/components/pages/shell";
import { SITE_NAME } from "@/lib/site";

/**
 * Contact.
 *
 * The message lands in the desk, in the same table the rest of the team
 * reads. No e-mail is sent from the site — the page says so, because a
 * visitor who waits for an inbox that never gets a letter will think the
 * form is broken.
 */

export const metadata: Metadata = {
  title: "Contact",
  description:
    `Scrie echipei ${SITE_NAME}. Mesajul tău ajunge direct în panoul de mesaje, fără e-mail și fără intermediar.`,
};

export default function Contact() {
  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Contact"
          title="Scrie-ne"
          lead={
            <>
              Un canal care nu pornește, o întrebare despre ghid, o corectură de
              fapt. Mesajul ajunge în panoul echipei {SITE_NAME} și este citit acolo.
            </>
          }
        />

        <PageSection className="py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
            <MessageForm page="contact" />

            <div className="space-y-5">
              <Note title="Cum ajunge mesajul">
                <p>
                  Scrierea ajunge în baza de date a echipei, ca un mesaj citibil
                  în panoul de mesaje. De acolo este citit și tratat de oameni.
                </p>
                <p className="mt-3">
                  <strong className="font-semibold text-ink">
                    Nu trimitem e-mail.
                  </strong>{" "}
                  Site-ul nu trimite niciun e-mail și nu are o adresă de expeditor.
                  De aceea răspunsul vine de la noi, în panou, nu în căsuța ta de
                  e-mail — și de aceea adresa de e-mail este opțională: las-o
                  doar dacă vrei ca să te contactăm.
                </p>
              </Note>

              <Note title="Ce ajută cel mai mult">
                <p>
                  Numele canalului, ora la care ai încercat să-l deschizi și
                  ce ai văzut: ecran negru, mesaj de eroare sau altceva. Cu
                  aceste trei lucruri, verificarea durează minute, nu zile.
                </p>
              </Note>

              <Note title="Ai o idee de canal?">
                <p>
                  Pentru un canal care nu este încă în catalog există o pagină
                  dedicată, unde mesajul ajunge marcat ca propunere:{" "}
                  <Link
                    href="/propune-un-canal"
                    className="text-signal-bright underline underline-offset-4"
                  >
                    propune un canal
                  </Link>
                  .
                </p>
              </Note>

              <Note title="Timpul de răspuns">
                <p>
                  Mesajele sunt citite în ordine, de obicei în aceeași zi
                  lucrătoare. Nu există un SLA și nu pretindem că există —
                  suntem puțini, iar unele lucruri cer verificări de câteva ore.
                </p>
              </Note>
            </div>
          </div>
        </PageSection>

        <PageSection className="pb-16 sm:pb-20">
          <LinkRow
            label="Mergi mai departe"
            links={[
              { label: "Propune un canal", href: "/propune-un-canal" },
              { label: "Toate canalele", href: "/canale/grupate" },
              { label: "Întrebări frecvente", href: "/intrebari" },
              { label: "Despre noi", href: "/despre" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
