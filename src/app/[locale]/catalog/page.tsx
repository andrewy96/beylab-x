import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale, Locale, locales } from "@/i18n";
import { blades, ratchets, bits, assists, lockChips } from "@/data/parts";
import CatalogClient from "@/components/CatalogClient";

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
  return { title: getDict(locale).catalog.title };
}

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDict(locale);
  const total = blades.length + lockChips.length + ratchets.length + bits.length + assists.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold tracking-wide">
        {dict.catalog.title}
      </h1>
      <p className="mb-8 mt-1 text-sm text-ink-dim">
        <span className="font-display font-bold text-accent">{total}</span>{" "}
        {dict.catalog.subtitle}
      </p>
      <CatalogClient locale={locale} dict={dict} />
    </div>
  );
}
