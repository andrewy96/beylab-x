import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale, Locale, locales } from "@/i18n";
import clubsData from "@/data/clubs.json";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDict(locale);
  return { title: dict.clubs.title, description: dict.clubs.subtitle };
}

interface ClubLink {
  type: string;
  url: string;
  label?: string;
}

interface Club {
  id: string;
  kind: "club" | "community" | "official";
  name: string;
  region: { en: string; zh: string };
  desc: { en: string; zh: string };
  venue?: { en: string; zh: string };
  schedule?: { en: string; zh: string };
  links: ClubLink[];
}

const LINK_LABEL: Record<string, { en: string; zh: string }> = {
  website: { en: "Website", zh: "网站" },
  events: { en: "Events", zh: "活动" },
  facebook: { en: "Facebook", zh: "Facebook" },
  instagram: { en: "Instagram", zh: "Instagram" },
  whatsapp: { en: "WhatsApp", zh: "WhatsApp" },
  telegram: { en: "Telegram", zh: "Telegram" },
  maps: { en: "Map", zh: "地图" },
};

export default async function ClubsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDict(locale);
  const c = dict.clubs;
  const clubs = clubsData.clubs as Club[];

  const kindLabel: Record<Club["kind"], string> = {
    club: c.kindClub,
    community: c.kindCommunity,
    official: c.kindOfficial,
  };
  const kindColor: Record<Club["kind"], string> = {
    club: "var(--color-accent)",
    community: "var(--color-accent-2)",
    official: "var(--color-bal)",
  };

  const steps = [
    { t: c.how1Title, x: c.how1Text, n: "01" },
    { t: c.how2Title, x: c.how2Text, n: "02" },
    { t: c.how3Title, x: c.how3Text, n: "03" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold tracking-wide">{c.title}</h1>
      <p className="mb-10 mt-1 text-sm text-ink-dim">{c.subtitle}</p>

      {/* How joining works */}
      <section>
        <h2 className="font-display text-xl font-bold tracking-wide">{c.howTitle}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="panel p-5">
              <div className="font-display text-3xl font-black text-edge">{s.n}</div>
              <div className="mt-2 font-semibold">{s.t}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">{s.x}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Directory */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-bold tracking-wide">{c.dirTitle}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {clubs.map((club) => (
            <div key={club.id} className="panel flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{club.name}</div>
                  <div className="mt-0.5 text-xs text-ink-dim">{club.region[locale]}</div>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{
                    color: kindColor[club.kind],
                    background: `color-mix(in srgb, ${kindColor[club.kind]} 13%, transparent)`,
                  }}
                >
                  {kindLabel[club.kind]}
                </span>
              </div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-dim">
                {club.desc[locale]}
              </p>
              {(club.venue || club.schedule) && (
                <div className="mt-3 space-y-1 text-xs text-ink-dim">
                  {club.venue && (
                    <div>
                      <span className="text-ink-dim/70">{c.venue}: </span>
                      {club.venue[locale]}
                    </div>
                  )}
                  {club.schedule && (
                    <div>
                      <span className="text-ink-dim/70">{c.schedule}: </span>
                      {club.schedule[locale]}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {club.links.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-edge bg-panel-2 px-3 py-1.5 text-xs font-semibold text-accent-2 transition hover:border-accent hover:text-accent"
                  >
                    {l.label ?? LINK_LABEL[l.type]?.[locale] ?? l.type} ↗
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add your club */}
      <section className="mt-12">
        <div className="panel bg-grid flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="font-display text-lg font-bold">{c.addTitle}</div>
            <p className="mt-1 text-sm leading-relaxed text-ink-dim">{c.addText}</p>
          </div>
          <a
            href="https://github.com/andrewy96/beylab-x/issues/new?title=Club%20listing%20request"
            target="_blank"
            rel="noopener noreferrer"
            className="clip-x shrink-0 bg-accent px-6 py-3 font-display text-sm font-bold tracking-wider text-bg transition hover:brightness-110"
          >
            {c.addCta} ↗
          </a>
        </div>
      </section>
    </div>
  );
}
