import generated from "./generated.json";
import overrides from "./overrides.json";

export type PartType = "attack" | "defense" | "stamina" | "balance" | "special" | "unknown";
export type Line = "BX" | "UX" | "CX" | "HASBRO" | "LIMITED";
export type Spin = "R" | "L";

export interface Stats {
  attack: number;
  defense: number;
  stamina: number;
  burst: number;
}

export interface Blade {
  id: string;
  code: string;
  canonical: string;
  en: string;
  enFull: string;
  zh: string;
  zhHant: string;
  variant: string | null;
  type: PartType;
  tier: string | null;
  buy: string | null;
  line: Line;
  spin: Spin;
  cx: boolean;
  collab: boolean;
  review: boolean;
  image: string | null;
  source: string | null;
  stockRatchet: string | null;
  stockBit: string | null;
  stockAssist: string | null;
  combos: string | null;
  stats: Stats;
}

export interface Ratchet {
  id: string;
  prongs: number | null;
  height: number | null;
  isMetal: boolean;
  image: string | null;
}

export interface Bit {
  id: string;
  name: string | null;
  image: string | null;
}

export interface Assist {
  id: string;
  name: string | null;
  image: string | null;
}

interface BladeOverride {
  en: string;
  variant?: string;
  line?: Line;
  spin?: Spin;
  cx?: boolean;
  collab?: boolean;
  review?: boolean;
}

const TIER_ORDER = ["X", "S+", "S", "A+", "A", "B+", "B", "C+", "C", "D+", "D", "E+", "E"];

export function tierRank(tier: string | null): number {
  if (!tier) return TIER_ORDER.length;
  const i = TIER_ORDER.indexOf(tier);
  return i === -1 ? TIER_ORDER.length : i;
}

function tierScore(tier: string | null): number {
  const r = tierRank(tier);
  return 1 - r / (TIER_ORDER.length + 1);
}

const TYPE_BASE: Record<PartType, Stats> = {
  attack: { attack: 9, defense: 4, stamina: 4, burst: 6 },
  defense: { attack: 4, defense: 9, stamina: 6, burst: 6 },
  stamina: { attack: 3, defense: 5, stamina: 9, burst: 6 },
  balance: { attack: 6, defense: 6, stamina: 6, burst: 6 },
  special: { attack: 6, defense: 5, stamina: 6, burst: 5 },
  unknown: { attack: 5, defense: 5, stamina: 5, burst: 5 },
};

function bladeStats(type: PartType, tier: string | null): Stats {
  const base = TYPE_BASE[type] ?? TYPE_BASE.unknown;
  const k = 0.7 + 0.4 * tierScore(tier);
  const scale = (v: number) => Math.min(10, Math.max(1, Math.round(v * k * 2) / 2));
  return {
    attack: scale(base.attack),
    defense: scale(base.defense),
    stamina: scale(base.stamina),
    burst: scale(base.burst),
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function deriveLine(code: string): Line {
  if (code.startsWith("UX")) return "UX";
  if (code.startsWith("CX")) return "CX";
  if (code.startsWith("BXG") || code.startsWith("BXH") || code.startsWith("BXC")) return "HASBRO";
  if (code.startsWith("BX")) return "BX";
  return "LIMITED";
}

function buildBlades(): Blade[] {
  const bladeOverrides = overrides.blades as unknown as Record<string, BladeOverride>;
  const usedIds = new Set<string>();
  const seenCanonical = new Map<string, number>();
  const blades: Blade[] = [];

  for (const raw of generated.blades) {
    const ov = bladeOverrides[raw.sheetId];
    const en = ov?.en ?? raw.zhHant;
    const canonical = slugify(en) || slugify(raw.sheetId);
    const dupIndex = seenCanonical.get(canonical) ?? 0;
    seenCanonical.set(canonical, dupIndex + 1);
    // Unlabeled duplicate of the same canonical part: label it with its product code.
    const variant = ov?.variant ?? (dupIndex > 0 ? raw.sheetId : null);

    let id = variant ? slugify(`${en} ${variant}`) : canonical;
    let n = 2;
    while (usedIds.has(id)) id = `${canonical}-${n++}`;
    usedIds.add(id);

    const type = (raw.type as PartType) in TYPE_BASE ? (raw.type as PartType) : "unknown";
    blades.push({
      id,
      code: raw.sheetId,
      canonical,
      en,
      enFull: variant ? `${en} (${variant})` : en,
      zh: raw.zhHans,
      zhHant: raw.zhHant,
      variant,
      type,
      tier: raw.tier,
      buy: raw.buy,
      line: ov?.line ?? deriveLine(raw.sheetId),
      spin: ov?.spin === "L" ? "L" : "R",
      cx: ov?.cx ?? raw.sheetId.startsWith("CX"),
      collab: ov?.collab ?? false,
      review: ov?.review ?? false,
      image: raw.image,
      source: raw.sourceHans,
      stockRatchet: raw.stockRatchet,
      stockBit: raw.stockBit,
      stockAssist: raw.stockAssist,
      combos: raw.combos,
      stats: bladeStats(type, raw.tier),
    });
  }
  return blades;
}

function buildRatchets(): Ratchet[] {
  return generated.ratchets
    .map((r) => {
      const m = /^([0-9M])-(\d+)$/.exec(r.id);
      return {
        id: r.id,
        prongs: m && m[1] !== "M" ? Number(m[1]) : null,
        height: m ? Number(m[2]) / 10 : null,
        isMetal: r.id.startsWith("M"),
        image: r.image,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

function buildBits(): Bit[] {
  const names = overrides.bits as Record<string, string | null>;
  return generated.bits
    .map((b) => ({ id: b.id, name: names[b.id] ?? null, image: b.image }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildAssists(): Assist[] {
  const names = overrides.assists as Record<string, string | null>;
  const seen = new Set<string>();
  const out: Assist[] = [];
  for (const a of generated.assists) {
    const letter = a.id.replace(/^輔助/, "").trim();
    if (!letter || seen.has(letter)) continue;
    seen.add(letter);
    out.push({ id: letter, name: names[letter] ?? null, image: a.image });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export const blades: Blade[] = buildBlades();
export const ratchets: Ratchet[] = buildRatchets();
export const bits: Bit[] = buildBits();
export const assists: Assist[] = buildAssists();

const bladeById = new Map(blades.map((b) => [b.id, b]));
const ratchetById = new Map(ratchets.map((r) => [r.id, r]));
const bitById = new Map(bits.map((b) => [b.id, b]));
const assistById = new Map(assists.map((a) => [a.id, a]));

export const findBlade = (id: string) => bladeById.get(id) ?? null;
export const findRatchet = (id: string) => ratchetById.get(id) ?? null;
export const findBit = (id: string) => bitById.get(id) ?? null;
export const findAssist = (id: string) => assistById.get(id) ?? null;

/** One entry per canonical part (best tier, prefers an entry with image and no variant). */
export function canonicalBlades(): Blade[] {
  const byCanonical = new Map<string, Blade>();
  for (const b of blades) {
    const cur = byCanonical.get(b.canonical);
    if (!cur) {
      byCanonical.set(b.canonical, b);
      continue;
    }
    const better =
      tierRank(b.tier) < tierRank(cur.tier) ||
      (tierRank(b.tier) === tierRank(cur.tier) &&
        ((!b.variant && !!cur.variant) || (!!b.image && !cur.image)));
    if (better) byCanonical.set(b.canonical, b);
  }
  return [...byCanonical.values()].sort((a, b) => a.en.localeCompare(b.en));
}

/** All entries sharing a canonical name (variant gallery). */
export function bladeVariants(canonical: string): Blade[] {
  return blades.filter((b) => b.canonical === canonical);
}

export const stats = {
  blades: blades.length,
  uniqueBlades: new Set(blades.map((b) => b.canonical)).size,
  ratchets: ratchets.length,
  bits: bits.length,
  assists: assists.length,
};
