import { Dict } from "@/i18n";
import { PartType } from "@/data/parts";

export const TYPE_COLOR: Record<PartType, string> = {
  attack: "var(--color-atk)",
  defense: "var(--color-def)",
  stamina: "var(--color-sta)",
  balance: "var(--color-bal)",
  special: "var(--color-spc)",
  unknown: "var(--color-ink-dim)",
};

export function TypeBadge({ type, dict, size = "sm" }: { type: PartType; dict: Dict; size?: "sm" | "md" }) {
  const color = TYPE_COLOR[type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {dict.types[type]}
    </span>
  );
}

const TIER_STYLE: Record<string, string> = {
  X: "text-accent border-accent/60",
  "S+": "text-accent-2 border-accent-2/60",
  S: "text-accent-2 border-accent-2/50",
};

export function TierChip({ tier, size = "sm" }: { tier: string | null; size?: "sm" | "md" }) {
  if (!tier) return null;
  const style = TIER_STYLE[tier] ?? "text-ink-dim border-edge";
  return (
    <span
      className={`inline-flex items-center rounded border font-display font-bold ${style} ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-sm"
      }`}
    >
      {tier}
    </span>
  );
}

export function SpinBadge({ spin, dict }: { spin: "R" | "L"; dict: Dict }) {
  if (spin !== "L") return null;
  return (
    <span className="inline-flex items-center rounded-full bg-spc/15 px-2 py-0.5 text-[10px] font-semibold text-spc">
      ↺ {dict.spin.L}
    </span>
  );
}
