import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDict, isLocale, Locale, locales } from "@/i18n";
import BuilderClient from "@/components/BuilderClient";

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
  return { title: dict.builder.title, description: dict.builder.subtitle };
}

export default async function BuilderPage({
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
      <h1 className="font-display text-3xl font-bold tracking-wide">{dict.builder.title}</h1>
      <p className="mb-8 mt-1 text-sm text-ink-dim">{dict.builder.subtitle}</p>
      <Suspense fallback={null}>
        <BuilderClient locale={locale} dict={dict} />
      </Suspense>
    </div>
  );
}
