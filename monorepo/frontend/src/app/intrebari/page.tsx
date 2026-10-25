import type { Metadata } from "next";
import Link from "next/link";
import {
  LinkRow,
  Note,
  PageHero,
  PageSection,
} from "@/components/pages/blocks";
import { PageShell } from "@/components/pages/shell";
import { PLANS, SITE_NAME, SITE_PROMISE_SHORT } from "@/lib/site";

/**
 * The questions people actually ask, answered honestly.
 *
 * Where the answer is "we do not know yet" or "we do not have that", the
 * page says that. A FAQ that invents answers is worse than no FAQ.
 */

/** The free tier's allowance, written the way a Romanian writes it. */
const FREE_TIER = PLANS[0].blurb.replace(/\.$/, "").toLowerCase();

/** The paid plans, by name, in the order they are offered. */
const PAID_PLANS = PLANS.filter((plan) => plan.price !== null)
  .map((plan) => plan.name.toLowerCase())
  .join(", ");

export const metadata: Metadata = {
  title: "Întrebări frecvente",
  description:
    `Răspunsuri la întrebările despre ${SITE_NAME}: de unde vin canalele, de ce nu merge unul, ce acoperă ghidul, cum măsurăm popularitatea și ce se întâmplă cu mesajele.`,
};

const QUESTIONS = [
  {
    q: `Ce este ${SITE_NAME}, pe scurt?`,
    a: (
      <>
        Un director de canale TV live românești, cu un player propriu și cu
        ghid de programe. Apeși pe un canal și se deschide. {SITE_PROMISE_SHORT},
        pe nicio pagină.
      </>
    ),
  },
  {
    q: "Este adevărat că nu sunt reclame?",
    a: (
      <>
        Da. {SITE_PROMISE_SHORT}. Nici afișate, nici ascunse în spatele unui
        buton de „continuă”, nici în ghid, nici în player. Dacă vei vedea
        vreodată o reclamă pe acest site, este o eroare și merită o
        sesizare.
      </>
    ),
  },
  {
    q: "De unde vin canalele?",
    a: (
      <>
        Din directoare publice care adună adresele de încorporare ale
        canalelor TV live. {SITE_NAME} nu găzduiește și nu retransmite emisiunile:
        verifică ce adrese funcționează și le pune la dispoziție într-un
        player propriu. Conținutul aparține deținătorilor canalelor.
      </>
    ),
  },
  {
    q: "Câte canale sunt?",
    a: (
      <>
        Numărul se schimbă la fiecare reconstruire a datelor. Pagina{" "}
        <Link href="/canale/grupate" className="text-signal-bright underline underline-offset-4">
          cu toate canalele
        </Link>{" "}
        arată lista de azi, împreună cu starea fiecăruia.
      </>
    ),
  },
  {
    q: "Un canal nu merge. De ce?",
    a: (
      <>
        Cele mai multe cazuri au trei explicații. Prima: gazda sursă a refuzat
        cererea din rețeaua noastră de verificare, deși de acasă merge — de
        aceea canalul apare ca indisponibil, nu dispărut. A doua: canalul
        folosește un protocol pentru care nu există player de web, iar atunci
        trebuie un plugin pe calculator. A treia: canalul chiar nu mai
        emite. Dacă știi că merge de la tine, spune-ne prin{" "}
        <Link href="/contact" className="text-signal-bright underline underline-offset-4">
          contact
        </Link>{" "}
        și-l reverificăm.
      </>
    ),
  },
  {
    q: "De ce nu apare canalul meu?",
    a: (
      <>
        Fie pentru că nu este în niciun director pe care le indexăm, fie
        pentru că nu are o adresă publică de încorporare. Ambele se
        rezolvă printr-o propunere:{" "}
        <Link
          href="/propune-un-canal"
          className="text-signal-bright underline underline-offset-4"
        >
          propune un canal
        </Link>
        . Nu se adaugă automat nimic — fiecare canal trece mai întâi prin
        verificare.
      </>
    ),
  },
  {
    q: "De ce ghidul nu are o săptămână întreagă?",
    a: (
      <>
        Pentru că ghidul este generat dintr-o singură zi care se rotește, cu
        primele ore ale zilei următoare. Am putea umple zilele lipsă cu
        programul de azi, dar atunci pagina ar arăta o săptămână care nu
        există. Preferăm să spunem că nu știm. Vezi{" "}
        <Link href="/ghid-tv" className="text-signal-bright underline underline-offset-4">
          cum funcționează ghidul
        </Link>
        .
      </>
    ),
  },
  {
    q: "Ghidul este exact?",
    a: (
      <>
        Nu întotdeauna. Ghidul vine de la un director public de programe și
        moștenește erorile lui: un program mutat în ultima oră, o emisiune
        anulată. Nu corectăm titlurile și nu le reinterpretăm. Raportează
        greșelile prin{" "}
        <Link href="/contact" className="text-signal-bright underline underline-offset-4">
          contact
        </Link>
        .
      </>
    ),
  },
  {
    q: "Cum măsurați popularitatea unui canal?",
    a: (
      <>
        În două feluri, și nu le amestecăm. Prima: numărăm, la proxy-ul
        nostru, câte browsere distincte cer un segment de la un canal în
        ultimele nouăzeci de secunde. Aceasta este o măsurătoare aici, în
        acest moment. A doua: directoarele de la care indexăm canalele
        publică un contor de popularitate, care este un clasament cumulativ,
        nu o audiență. Pe pagina de top, cele două au marcaje diferite.
      </>
    ),
  },
  {
    q: "Există un clasament al emisiunilor?",
    a: (
      <>
        Există, dar nu este votat. Clasamentul este derivat din ghid: câte
        canale difuzează același titlu, cât de multă audiență au acele canale
        și dacă emisiunea rulează acum. Cum se calculează, pe pagina{" "}
        <Link href="/top-emisiuni" className="text-signal-bright underline underline-offset-4">
          top emisiuni
        </Link>
        .
      </>
    ),
  },
  {
    q: `Pot vedea ${SITE_NAME} pe telefon?`,
    a: (
      <>
        Da. Site-ul este făcut pentru telefon și pentru calculator, iar pe
        telefon poate fi adăugat pe ecranul principal, unde se deschide ca o
        aplicație.
      </>
    ),
  },
  {
    q: "Cât pot viziona?",
    a: (
      <>
        Cu un cont gratuit ai {FREE_TIER}. Planurile plătite ridică limita —{" "}
        {PAID_PLANS}. Prețurile și ce cuprinde fiecare plan sunt afișate pe{" "}
        <Link href="/preturi" className="text-signal-bright underline underline-offset-4">
          pagina cu planurile
        </Link>
        , înainte de orice plată. {SITE_PROMISE_SHORT}, în niciun plan.
      </>
    ),
  },
  {
    q: "Îmi salvez favoritele. Se pierd?",
    a: (
      <>
        Favoritele sunt păstrate în acest browser, pe acest dispozitiv. Ele nu
        se trimit undeva și nu sunt asociate cu tine. Dacă schimbi telefonul
        sau ștergi datele browserului, se pierd. Un cont {SITE_NAME} păstrează
        favoritele și istoricul pe mai multe dispozitive.
      </>
    ),
  },
  {
    q: "Trimiteți e-mail?",
    a: (
      <>
        Nu. Mesajele trimise prin formularul de contact ajung în panoul
        echipei, unde sunt citite de oameni. Nu există niciun e-mail
        trimis de pe site și nicio adresă de expeditor. De aceea, în
        formulare, adresa de e-mail este opțională: las-o doar dacă vrei ca
        să te contactăm.
      </>
    ),
  },
  {
    q: "Ce se întâmplă cu datele mele?",
    a: (
      <>
        Nu vindem și nu cumpărăm date despre tine. Nimic nu este revândut
        terților și nu există reclame care să urmărească. Detaliile sunt în{" "}
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
      </>
    ),
  },
  {
    q: "Este legal să vezi aceste canale aici?",
    a: (
      <>
        {SITE_NAME} este un director: nu găzduiește și nu retransmite conținutul.
        Emisiunile aparțin deținătorilor lor, iar utilizarea lor rămâne
        responsabilitatea fiecăruia. Citim despre asta, fără nuanțe, în{" "}
        <Link href="/disclaimer" className="text-signal-bright underline underline-offset-4">
          disclaimer
        </Link>{" "}
        și în{" "}
        <Link href="/dmca" className="text-signal-bright underline underline-offset-4">
          pagina de drepturi de autor
        </Link>
        .
      </>
    ),
  },
];

export default function Intrebari() {
  return (
    <PageShell>
      <>
        <PageHero
          eyebrow="Întrebări frecvente"
          title="Întrebările pe care le primim cel mai des"
          lead={
            <>
              Răspunsuri scurte, la întrebare. Unde nu avem un răspuns, scriem
              că nu avem — și spunem ce se întâmplă în schimb.
            </>
          }
        />

        <PageSection className="py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-14">
            <div className="max-w-2xl">
              <dl className="divide-y divide-white/[0.055] border-y border-white/[0.055]">
                {QUESTIONS.map((item) => (
                  <div key={item.q} className="py-6">
                    <dt className="font-display text-[16px] font-semibold tracking-tight text-ink">
                      {item.q}
                    </dt>
                    <dd className="mt-2.5 text-[14.5px] leading-[1.7] text-ink-muted">
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="space-y-5">
              <Note title="Nu găsești răspunsul?">
                <p>
                  Scrie-ne prin{" "}
                  <Link href="/contact" className="text-signal-bright underline underline-offset-4">
                    contact
                  </Link>
                  . Mesajul ajunge în panoul echipei și este citit de oameni —
                  nu într-o căsuță de e-mail, pentru că site-ul nu trimite
                  e-mailuri.
                </p>
              </Note>

              <Note title="Pagini care merită citite">
                <ul className="space-y-2">
                  <li>
                    <Link href="/ghid-tv" className="text-signal-bright underline underline-offset-4">
                      Cum se folosește ghidul TV
                    </Link>
                  </li>
                  <li>
                    <Link href="/despre" className="text-signal-bright underline underline-offset-4">
                      Despre noi
                    </Link>
                  </li>
                  <li>
                    <Link href="/dmca" className="text-signal-bright underline underline-offset-4">
                      Drepturi de autor
                    </Link>
                  </li>
                  <li>
                    <Link href="/termeni" className="text-signal-bright underline underline-offset-4">
                      Termeni și condiții
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
              { label: "Propune un canal", href: "/propune-un-canal" },
              { label: "Toate canalele", href: "/canale/grupate" },
              { label: "Despre noi", href: "/despre" },
            ]}
          />
        </PageSection>
      </>
    </PageShell>
  );
}
