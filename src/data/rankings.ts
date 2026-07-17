import rankingsData from "./rankings.json";
import { blades, Blade } from "./parts";

export interface RankedCombo {
  rank: number;
  bladeCode: string;
  bladeZh: string;
  ratchet: string;
  bit: string;
  score: number;
  wins: number;
  first: number;
  second: number;
  third: number;
  champRate: number;
  recent90: number;
  lastDate: string | null;
  blade: Blade | null;
  /** Query string for the builder when the blade is in our catalog. */
  builderQuery: string | null;
}

const byCode = new Map(blades.map((b) => [b.code, b]));

export const rankings: RankedCombo[] = rankingsData.rankings.map((r) => {
  const blade = byCode.get(r.bladeCode) ?? null;
  const cxQuery = blade?.cx
    ? `${blade.lockChip ? `&l=${encodeURIComponent(blade.lockChip)}` : ""}${
        blade.stockAssist ? `&a=${encodeURIComponent(blade.stockAssist)}` : ""
      }`
    : "";
  return {
    ...r,
    blade,
    builderQuery: blade
      ? `b=${encodeURIComponent(blade.id)}${cxQuery}&r=${encodeURIComponent(r.ratchet)}&t=${encodeURIComponent(r.bit)}`
      : null,
  };
});

export const rankingsUpdatedAt: string = rankingsData.fetchedAt;

/** "Phoenix Wing 9-60GF"-style display name for a ranked combo. */
export function rankedComboName(r: RankedCombo, locale: "en" | "zh"): string {
  const bladeName = r.blade ? (locale === "zh" ? r.blade.zh : r.blade.en) : r.bladeZh;
  return `${bladeName} ${r.ratchet}${r.bit}`;
}
