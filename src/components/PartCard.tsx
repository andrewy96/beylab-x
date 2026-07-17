import Link from "next/link";
import { Dict, Locale } from "@/i18n";
import { Assist, Bit, Blade, Ratchet } from "@/data/parts";
import { TypeBadge, TierChip, SpinBadge, TYPE_COLOR } from "./badges";
import PartImage from "./PartImage";

export function BladeCard({
  blade,
  locale,
  dict,
}: {
  blade: Blade;
  locale: Locale;
  dict: Dict;
}) {
  const name = locale === "zh" ? blade.zh : blade.enFull;
  const alt = locale === "zh" ? blade.enFull : blade.zh;
  return (
    <Link
      href={`/${locale}/parts/blade/${blade.id}`}
      className="panel group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-accent/50"
    >
      <div className="relative flex h-36 items-center justify-center bg-gradient-to-b from-panel-2 to-panel p-3">
        <div className="absolute left-2 top-2">
          <TierChip tier={blade.tier} />
        </div>
        <div className="absolute right-2 top-2 font-display text-[10px] tracking-wider text-ink-dim">
          {blade.code}
        </div>
        <PartImage
          src={blade.image}
          alt={name}
          fallbackLabel="X"
          color={TYPE_COLOR[blade.type]}
          className="transition group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="truncate text-sm font-semibold" title={name}>
          {name}
        </div>
        <div className="truncate text-xs text-ink-dim">{alt}</div>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <TypeBadge type={blade.type} dict={dict} />
          <SpinBadge spin={blade.spin} dict={dict} />
          {blade.cx && (
            <span className="rounded-full bg-accent-2/10 px-2 py-0.5 text-[10px] font-semibold text-accent-2">
              CX
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function SimplePartCard({
  category,
  id,
  title,
  subtitle,
  image,
  locale,
  badge,
}: {
  category: "ratchet" | "bit" | "assist" | "lock-chip";
  id: string;
  title: string;
  subtitle: string | null;
  image: string | null;
  locale: Locale;
  badge?: string;
}) {
  return (
    <Link
      href={`/${locale}/parts/${category}/${encodeURIComponent(id)}`}
      className="panel group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-accent/50"
    >
      <div className="relative flex h-28 items-center justify-center bg-gradient-to-b from-panel-2 to-panel p-3">
        {badge && (
          <span className="absolute right-2 top-2 rounded bg-edge/70 px-1.5 py-0.5 font-display text-[9px] text-ink-dim">
            {badge}
          </span>
        )}
        <PartImage src={image} alt={title} fallbackLabel={title} className="transition group-hover:scale-105" />
      </div>
      <div className="p-3">
        <div className="font-display text-sm font-bold">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-xs text-ink-dim">{subtitle}</div>}
      </div>
    </Link>
  );
}
