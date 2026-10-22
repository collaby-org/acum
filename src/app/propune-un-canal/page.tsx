import type { Metadata } from "next";
import Link from "next/link";
import {
  LinkRow,
  Note,
  PageHero,
  PageSection,
  Stat,
} from "@/components/pages/blocks";
import { MessageForm } from "@/components/pages/message-form";
import { CHANNELS } from "@/data/channels";
import { PageShell } from "@/components/pages/shell";
import { SITE_NAME } from "@/lib/site";

/**
 * Propose a channel.
 *
 * The proposal is written into the same messages table as a contact
 * message, marked as a proposal — so the desk reads it in the same place,
 * and nothing has to be migrated if the desk grows a dedicated table later.
 */

export const metadata: Metadata = {
  title: "Propune un canal",
  description:
    `Propune un canal TV care nu este încă în catalogul ${SITE_NAME}. Mesajul ajunge direct în panoul echipei.`,
};

export default function PropuneUnCanal() {
  const total = CHANNELS.length;

  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Propunere"
          title="Propune un canal TV"
          lead={
            <>
              Lipsesc canale. Dacă știi unul care merită să fie în catalog,
              spune-ne — și ajunge în panoul echipei, marcat ca propunere, ca să
              fie tratată înaintea mesajelor obișnuite.
            </>
          }
          meta={
            <>
              <span>{total} canale în catalog acum</span>
              <span aria-hidden className="text-ink-faint/50">
                ·
              </span>
              <span>propunerile sunt verificate unul cu unul</span>
            </>
          }
        >
          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="În catalog" value={total} />
            <Stat label="Verificate" value="unul cu unul" />
            <Stat label="În panou" value="imediat" />
            <Stat label="E-mail" value="nu" hint="Nu trimitem e-mail." />
          </div>
        </PageHero>

        <PageSection className="py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
            <MessageForm page="propunere-canal" variant="proposal" />

            <div className="space-y-5">
              <Note title="Ce se întâmplă cu o propunere">
                <ol className="list-decimal space-y-2 pl-5">
                  <li>Mesajul ajunge în panou, marcat ca propunere de canal.</li>
                  <li>
                    Verificăm dacă canalul emite efectiv și dacă fluxul poate fi
                    redat într-un browser obișnuit.
                  </li>
                  <li>
                    Dacă da, intră în catalog la următoarea reconstruire a
                    datelor și primește pagina lui, cu program.
                  </li>
                  <li>
                    Dacă nu, spuneți în panou — și rămâne în așteptare, fără să
                    fie șters.
                  </li>
                </ol>
              </Note>

              <Note title="Adresa de pe care se vede">
                <p>
                  O adresă publică este utilă, dar nu este obligatorie. Poate fi
                  pagina canalului ori o listă publică de canale pe care apare.
                  Nu cerem și nu publicăm adrese private.
                </p>
              </Note>

              <Note title="Despre drepturi">
                <p>
                  {SITE_NAME} este un director: nu găzduim și nu retransmitem emisiunile.
                  Indexăm adresele publice pe care canalele le oferă pentru
                  încorporare și le verificăm. Pentru detalii, vezi{" "}
                  <Link
                    href="/dmca"
                    className="text-signal-bright underline underline-offset-4"
                  >
                    pagina de drepturi de autor
                  </Link>{" "}
                  și{" "}
                  <Link
                    href="/disclaimer"
                    className="text-signal-bright underline underline-offset-4"
                  >
                    disclaimerul
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
              { label: "Contact", href: "/contact" },
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
