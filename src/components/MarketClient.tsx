"use client";

import { useMemo, useState } from "react";
import { Dict, Locale } from "@/i18n";
import market from "@/data/market.json";
import { blades, findBlade } from "@/data/parts";
import PartImage from "./PartImage";
import { TYPE_COLOR } from "./badges";

type Status = "in" | "out" | "preorder";
type Kind = "bey" | "set" | "launcher" | "stadium" | "accessory";

interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  status: Status;
  line: string;
  kind: Kind;
}

const LINES = ["BX", "UX", "CX", "BXG"];
const KINDS: Kind[] = ["bey", "set", "launcher", "stadium", "accessory"];
const STATUSES: Status[] = ["in", "preorder", "out"];

const bladeByCode = new Map(blades.map((b) => [b.code, b]));

function productImage(p: Product) {
  const blade = bladeByCode.get(p.code);
  return blade?.image ?? null;
}

function StatusChip({ status, dict }: { status: Status; dict: Dict }) {
  const map: Record<Status, { label: string; color: string }> = {
    in: { label: dict.market.statusIn, color: "var(--color-sta)" },
    out: { label: dict.market.statusOut, color: "var(--color-ink-dim)" },
    preorder: { label: dict.market.statusPre, color: "var(--color-accent-2)" },
  };
  const { label, color } = map[status];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {label}
    </span>
  );
}

function LockedButton({
  label,
  dict,
  primary = false,
}: {
  label: string;
  dict: Dict;
  primary?: boolean;
}) {
  return (
    <button
      disabled
      title={dict.market.locked}
      className={`clip-x cursor-not-allowed px-4 py-2 font-display text-xs font-bold tracking-wider opacity-45 ${
        primary ? "bg-accent text-bg" : "border border-edge bg-panel-2 text-ink-dim"
      }`}
    >
      🔒 {label}
    </button>
  );
}

export default function MarketClient({ locale, dict }: { locale: Locale; dict: Dict }) {
  const [q, setQ] = useState("");
  const [line, setLine] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const products = market.products as Product[];
  const query = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    return products.filter(
      (p) =>
        (!query || p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query)) &&
        (line === "all" || p.line === line) &&
        (kind === "all" || p.kind === kind) &&
        (status === "all" || p.status === status)
    );
  }, [products, query, line, kind, status]);

  const kindLabel: Record<Kind, string> = {
    bey: dict.market.kindBey,
    set: dict.market.kindSet,
    launcher: dict.market.kindLauncher,
    stadium: dict.market.kindStadium,
    accessory: dict.market.kindAccessory,
  };
  const statusLabel: Record<Status, string> = {
    in: dict.market.statusIn,
    out: dict.market.statusOut,
    preorder: dict.market.statusPre,
  };

  const selectCls =
    "rounded-md border border-edge bg-panel px-2.5 py-1.5 text-xs text-ink outline-none transition focus:border-accent";

  const samples = [
    { bladeId: "wizard-rod", price: 45, condition: dict.market.conditionA, seller: "blader_kl" },
    { bladeId: "dran-buster", price: 60, condition: dict.market.conditionNew, seller: "xtreme_jb" },
    { bladeId: "shark-edge", price: 25, condition: dict.market.conditionB, seller: "spin_penang" },
  ];

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={dict.market.searchPlaceholder}
          className="w-full max-w-sm rounded-md border border-edge bg-panel px-3 py-2 text-sm outline-none transition placeholder:text-ink-dim/60 focus:border-accent"
        />
        <select value={line} onChange={(e) => setLine(e.target.value)} className={selectCls} aria-label={dict.market.filterLine}>
          <option value="all">{dict.market.filterLine}: {dict.market.all}</option>
          {LINES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={selectCls} aria-label={dict.market.filterKind}>
          <option value="all">{dict.market.filterKind}: {dict.market.all}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>{kindLabel[k]}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} aria-label={dict.market.filterStatus}>
          <option value="all">{dict.market.filterStatus}: {dict.market.all}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel[s]}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-ink-dim">
          {filtered.length} {dict.market.results}
        </span>
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-dim">{dict.market.noResults}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const img = productImage(p);
            const blade = bladeByCode.get(p.code);
            return (
              <div key={p.id} className="panel flex flex-col overflow-hidden">
                <div className="relative flex h-32 items-center justify-center bg-gradient-to-b from-panel-2 to-panel p-3">
                  <span className="absolute left-2 top-2 rounded bg-edge/70 px-1.5 py-0.5 font-display text-[9px] tracking-wider text-ink-dim">
                    {p.code}
                  </span>
                  <div className="absolute right-2 top-2">
                    <StatusChip status={p.status} dict={dict} />
                  </div>
                  <PartImage
                    src={img}
                    alt={p.name}
                    fallbackLabel={p.line}
                    color={blade ? TYPE_COLOR[blade.type] : undefined}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <div className="line-clamp-2 min-h-8 text-xs font-semibold leading-tight" title={p.name}>
                    {p.name}
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                    <div className="font-display text-lg font-bold text-accent">
                      RM {p.price.toFixed(2)}
                    </div>
                  </div>
                  <LockedButton
                    label={p.status === "preorder" ? dict.market.preorder : dict.market.buy}
                    dict={dict}
                    primary={p.status !== "out"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* P2P preview */}
      <section className="mt-14">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl font-bold tracking-wide">{dict.market.p2pTitle}</h2>
          <span className="rounded-full border border-accent-2/50 px-2.5 py-0.5 font-display text-[10px] font-bold tracking-widest text-accent-2">
            {dict.market.comingSoon}
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-ink-dim">{dict.market.p2pText}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {samples.map((s) => {
            const blade = findBlade(s.bladeId);
            if (!blade) return null;
            return (
              <div key={s.bladeId} className="panel relative overflow-hidden p-4 opacity-80">
                <span className="absolute right-3 top-3 rotate-6 rounded border border-bal/60 px-2 py-0.5 font-display text-[10px] font-bold tracking-widest text-bal">
                  {dict.market.sample}
                </span>
                <div className="mx-auto h-24 w-24">
                  <PartImage
                    src={blade.image}
                    alt={blade.en}
                    fallbackLabel="X"
                    color={TYPE_COLOR[blade.type]}
                  />
                </div>
                <div className="mt-2 text-sm font-semibold">
                  {locale === "zh" ? blade.zh : blade.en}
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-ink-dim">
                  <div>
                    {dict.market.condition}: {s.condition}
                  </div>
                  <div>
                    {dict.market.seller}: @{s.seller}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-display text-lg font-bold text-accent">RM {s.price.toFixed(2)}</span>
                  <LockedButton label={dict.market.buy} dict={dict} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <LockedButton label={dict.market.p2pSellCta} dict={dict} primary />
        </div>
      </section>
    </div>
  );
}
