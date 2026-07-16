import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale, Locale, locales } from "@/i18n";
import { RegisterForm } from "@/components/AuthForms";

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
  return { title: getDict(locale).auth.register };
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDict(locale);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 text-center font-display text-3xl font-bold tracking-wide">
        {dict.auth.register}
      </h1>
      <p className="mb-6 text-center text-sm text-bal">{dict.auth.starsStart}</p>
      <RegisterForm locale={locale} dict={dict} />
    </div>
  );
}
