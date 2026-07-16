import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDict, isLocale, Locale, locales } from "@/i18n";
import ScoreboardClient from "@/components/ScoreboardClient";

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
  return { title: dict.battle.scoreboard, description: dict.battle.scoreboardSub };
}

export default async function ScorePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDict(locale);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-center font-display text-3xl font-bold tracking-wide">
        {dict.battle.scoreboard}
      </h1>
      <p className="mb-8 mt-1 text-center text-sm text-ink-dim">{dict.battle.scoreboardSub}</p>
      <Suspense fallback={null}>
        <ScoreboardClient locale={locale} dict={dict} />
      </Suspense>
    </div>
  );
}
