import {
  Blade,
  Ratchet,
  Bit,
  Assist,
  Stats,
  findBlade,
  findRatchet,
  findBit,
  findAssist,
} from "@/data/parts";

export interface Combo {
  blade: Blade | null;
  ratchet: Ratchet | null;
  bit: Bit | null;
  assist: Assist | null;
}

export const EMPTY_COMBO: Combo = { blade: null, ratchet: null, bit: null, assist: null };

/** Serialize a combo into URL search params (shared links). */
export function comboToParams(combo: Combo): URLSearchParams {
  const p = new URLSearchParams();
  if (combo.blade) p.set("b", combo.blade.id);
  if (combo.ratchet) p.set("r", combo.ratchet.id);
  if (combo.bit) p.set("t", combo.bit.id);
  if (combo.assist && combo.blade?.cx) p.set("a", combo.assist.id);
  return p;
}

export function comboFromParams(params: URLSearchParams): Combo {
  const blade = params.get("b") ? findBlade(params.get("b")!) : null;
  return {
    blade,
    ratchet: params.get("r") ? findRatchet(params.get("r")!) : null,
    bit: params.get("t") ? findBit(params.get("t")!) : null,
    assist: blade?.cx && params.get("a") ? findAssist(params.get("a")!) : null,
  };
}

/** Official-style combo name, e.g. "Phoenix Wing 9-60GF" or "Dran Brave S3-60F". */
export function comboName(combo: Combo, locale: "en" | "zh" = "en"): string {
  if (!combo.blade) return "";
  const bladeName = locale === "zh" ? combo.blade.zh : combo.blade.en;
  const assist = combo.blade.cx && combo.assist ? combo.assist.id : "";
  const tail = [assist + (combo.ratchet?.id ?? ""), combo.bit?.id ?? ""].join("");
  return tail ? `${bladeName} ${tail}` : bladeName;
}

export function isComplete(combo: Combo): boolean {
  return !!(combo.blade && combo.ratchet && combo.bit && (!combo.blade.cx || combo.assist));
}

/** Keyword-based bit personality used for aggregate stats. */
function bitEffect(bit: Bit): Partial<Stats> {
  const n = (bit.name ?? "").toLowerCase();
  if (!n) return { attack: 0.5, defense: 0.5, stamina: 0.5, burst: 0.5 };
  if (n.includes("flat") || n.includes("rush") || n.includes("accel") || n.includes("kick") || n.includes("zap") || n.includes("vortex"))
    return { attack: 2, stamina: -0.5, burst: n.includes("gear") ? 1 : 0 };
  if (n.includes("needle") || n.includes("spike") || n.includes("point") || n.includes("dot"))
    return { stamina: 1.5, defense: 1 };
  if (n.includes("ball") || n.includes("orb"))
    return { defense: 1.5, stamina: 1 };
  if (n.includes("taper") || n.includes("level") || n.includes("hexa") || n.includes("unite") || n.includes("wedge") || n.includes("glide") || n.includes("elevate") || n.includes("quake") || n.includes("cyclone"))
    return { attack: 0.75, defense: 0.75, stamina: 0.75 };
  return { attack: 0.5, defense: 0.5, stamina: 0.5, burst: 0.5 };
}

function ratchetEffect(r: Ratchet): Partial<Stats> {
  const out: Partial<Stats> = {};
  if (r.height != null) {
    if (r.height <= 5.5) out.attack = 1;
    if (r.height >= 8) out.defense = 1;
  }
  if (r.isMetal) out.stamina = 1;
  if (r.prongs != null && (r.prongs === 0 || r.prongs >= 9)) out.burst = 1;
  return out;
}

const clamp10 = (v: number) => Math.min(10, Math.max(0, Math.round(v * 2) / 2));

export function comboStats(combo: Combo): Stats | null {
  if (!combo.blade) return null;
  const s: Stats = { ...combo.blade.stats };
  const apply = (e: Partial<Stats>) => {
    s.attack += e.attack ?? 0;
    s.defense += e.defense ?? 0;
    s.stamina += e.stamina ?? 0;
    s.burst += e.burst ?? 0;
  };
  if (combo.ratchet) apply(ratchetEffect(combo.ratchet));
  if (combo.bit) apply(bitEffect(combo.bit));
  return {
    attack: clamp10(s.attack),
    defense: clamp10(s.defense),
    stamina: clamp10(s.stamina),
    burst: clamp10(s.burst),
  };
}

export function comboType(combo: Combo): "attack" | "defense" | "stamina" | "balance" | null {
  const s = comboStats(combo);
  if (!s) return null;
  const entries: ["attack" | "defense" | "stamina", number][] = [
    ["attack", s.attack],
    ["defense", s.defense],
    ["stamina", s.stamina],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][1] - entries[1][1] < 1.5 ? "balance" : entries[0][0];
}
