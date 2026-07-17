"use client";

import { useMemo, useState } from "react";
import { Dict, Locale } from "@/i18n";
import {
  blades,
  ratchets,
  bits,
  assists,
  lockChips,
  tierRank,
  Blade,
  Line,
  PartType,
} from "@/data/parts";
import { BladeCard, SimplePartCard } from "./PartCard";

type Tab = "blades" | "lockChips" | "ratchets" | "bits" | "assists";
type Sort = "tier" | "name" | "code";

const TYPES: PartType[] = ["attack", "defense", "stamina", "balance", "special"];
const LINES: Line[] = ["BX", "UX", "CX", "HASBRO", "LIMITED"];

function matchBlade(b: Blade, q: string): boolean {
  const hay = `${b.en} ${b.enFull} ${b.zh} ${b.zhHant} ${b.code} ${b.id}`.toLowerCase();
  return hay.includes(q);
}

export default function CatalogClient({
  locale,
  dict,
  initialTab = "blades",
}: {
  locale: Locale;
  dict: Dict;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState("");
  const [type, setType] = useState<PartType | "all">("all");
  const [line, setLine] = useState<Line | "all">("all");
  const [spin, setSpin] = useState<"all" | "R" | "L">("all");
  const [sort, setSort] = useState<Sort>("tier");
  const [group, setGroup] = useState(true);

  const query = q.trim().toLowerCase();

  const filteredBlades = useMemo(() => {
    let list = blades;
    if (group) {
      // One representative per canonical name: best tier, prefer the unlabeled original
      const best = new Map<string, Blade>();
      for (const b of blades) {
        const cur = best.get(b.canonical);
        if (
          !cur ||
          tierRank(b.tier) < tierRank(cur.tier) ||
          (tierRank(b.tier) === tierRank(cur.tier) && !b.variant && !!cur.variant)
        ) {
          best.set(b.canonical, b);
        }
      }
      list = [...best.values()];
    }
    if (query) list = list.filter((b) => matchBlade(b, query));
    if (type !== "all") list = list.filter((b) => b.type === type);
    if (line !== "all") list = list.filter((b) => b.line === line);
    if (spin !== "all") list = list.filter((b) => b.spin === spin);
    const bySort: Record<Sort, (a: Blade, b: Blade) => number> = {
      tier: (a, b) => tierRank(a.tier) - tierRank(b.tier) || a.en.localeCompare(b.en),
      name: (a, b) => (locale === "zh" ? a.zh.localeCompare(b.zh, "zh") : a.en.localeCompare(b.en)),
      code: (a, b) => a.code.localeCompare(b.code, "en", { numeric: true }),
    };
    return [...list].sort(bySort[sort]);
  }, [query, type, line, spin, sort, group, locale]);

  const filteredRatchets = useMemo(
    () => ratchets.filter((r) => !query || r.id.toLowerCase().includes(query)),
    [query]
  );
  const filteredBits = useMemo(
    () =>
      bits.filter(
        (b) =>
          !query ||
          b.id.toLowerCase().includes(query) ||
          (b.name ?? "").toLowerCase().includes(query)
      ),
    [query]
  );
  const filteredLockChips = useMemo(
    () =>
      lockChips.filter(
        (l) =>
          !query ||
          l.id.toLowerCase().includes(query) ||
          l.name.toLowerCase().includes(query) ||
          l.zh.toLowerCase().includes(query) ||
          l.zhHant.toLowerCase().includes(query)
      ),
    [query]
  );
  const filteredAssists = useMemo(
    () =>
      assists.filter(
        (a) =>
          !query ||
          a.id.toLowerCase().includes(query) ||
          (a.name ?? "").toLowerCase().includes(query)
      ),
    [query]
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "blades", label: dict.catalog.tabBlades, count: filteredBlades.length },
    { key: "lockChips", label: dict.catalog.tabLockChips, count: filteredLockChips.length },
    { key: "ratchets", label: dict.catalog.tabRatchets, count: filteredRatchets.length },
    { key: "bits", label: dict.catalog.tabBits, count: filteredBits.length },
    { key: "assists", label: dict.catalog.tabAssists, count: filteredAssists.length },
  ];

  const selectCls =
    "rounded-md border border-edge bg-panel px-2.5 py-1.5 text-xs text-ink outline-none transition focus:border-accent";

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`clip-x px-4 py-2 font-display text-xs font-bold tracking-wider transition ${
              tab === t.key
                ? "bg-accent text-bg"
                : "border border-edge bg-panel text-ink-dim hover:text-ink"
            }`}
          >
            {t.label} <span className="opacity-70">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={dict.catalog.searchPlaceholder}
          className="w-full max-w-sm rounded-md border border-edge bg-panel px-3 py-2 text-sm outline-none transition placeholder:text-ink-dim/60 focus:border-accent"
        />
        {tab === "blades" && (
          <>
            <select value={type} onChange={(e) => setType(e.target.value as PartType | "all")} className={selectCls} aria-label={dict.catalog.filterType}>
              <option value="all">{dict.catalog.filterType}: {dict.catalog.all}</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>{dict.types[t]}</option>
              ))}
            </select>
            <select value={line} onChange={(e) => setLine(e.target.value as Line | "all")} className={selectCls} aria-label={dict.catalog.filterLine}>
              <option value="all">{dict.catalog.filterLine}: {dict.catalog.all}</option>
              {LINES.map((l) => (
                <option key={l} value={l}>{dict.linesShort[l]}</option>
              ))}
            </select>
            <select value={spin} onChange={(e) => setSpin(e.target.value as "all" | "R" | "L")} className={selectCls} aria-label={dict.catalog.filterSpin}>
              <option value="all">{dict.catalog.filterSpin}: {dict.catalog.all}</option>
              <option value="R">{dict.spin.R}</option>
              <option value="L">{dict.spin.L}</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={selectCls} aria-label={dict.catalog.sortBy}>
              <option value="tier">{dict.catalog.sortBy}: {dict.catalog.sortTier}</option>
              <option value="name">{dict.catalog.sortBy}: {dict.catalog.sortName}</option>
              <option value="code">{dict.catalog.sortBy}: {dict.catalog.sortCode}</option>
            </select>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-dim">
              <input
                type="checkbox"
                checked={group}
                onChange={(e) => setGroup(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              {dict.catalog.variantsHidden}
            </label>
          </>
        )}
      </div>

      {/* Grid */}
      {tab === "blades" &&
        (filteredBlades.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-dim">{dict.catalog.noResults}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredBlades.map((b) => (
              <BladeCard key={b.id} blade={b} locale={locale} dict={dict} />
            ))}
          </div>
        ))}

      {tab === "lockChips" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {filteredLockChips.map((l) => (
            <SimplePartCard
              key={l.id}
              category="lock-chip"
              id={l.id}
              title={locale === "zh" ? l.zh : l.id}
              subtitle={l.hasMetal ? dict.part.metalLockChip : locale === "zh" ? dict.part.lockChip : l.name}
              image={l.image}
              locale={locale}
              badge="CX"
            />
          ))}
        </div>
      )}

      {tab === "ratchets" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {filteredRatchets.map((r) => (
            <SimplePartCard
              key={r.id}
              category="ratchet"
              id={r.id}
              title={r.id}
              subtitle={
                r.height != null
                  ? `${r.prongs ?? "M"} · ${r.height.toFixed(1)}mm`
                  : null
              }
              image={r.image}
              locale={locale}
            />
          ))}
        </div>
      )}

      {tab === "bits" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {filteredBits.map((b) => (
            <SimplePartCard
              key={b.id}
              category="bit"
              id={b.id}
              title={b.id}
              subtitle={b.name}
              image={b.image}
              locale={locale}
            />
          ))}
        </div>
      )}

      {tab === "assists" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {filteredAssists.map((a) => (
            <SimplePartCard
              key={a.id}
              category="assist"
              id={a.id}
              title={a.id}
              subtitle={a.name}
              image={a.image}
              locale={locale}
              badge="CX"
            />
          ))}
        </div>
      )}
    </div>
  );
}
