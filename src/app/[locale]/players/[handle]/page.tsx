import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale, Locale } from "@/i18n";
import { PlayerClient } from "@/components/ProfileClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>;
}): Promise<Metadata> {
  const { locale, handle } = await params;
  if (!isLocale(locale)) return {};
  return { title: `@${decodeURIComponent(handle)}` };
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>;
}) {
  const { locale: raw, handle } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDict(locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PlayerClient handle={decodeURIComponent(handle)} locale={locale} dict={dict} />
    </div>
  );
}
