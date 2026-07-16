import { Dict } from "@/i18n";
import { Stats } from "@/data/parts";

const BARS: { key: keyof Stats; color: string; label: (d: Dict) => string }[] = [
  { key: "attack", color: "var(--color-atk)", label: (d) => d.part.statAttack },
  { key: "defense", color: "var(--color-def)", label: (d) => d.part.statDefense },
  { key: "stamina", color: "var(--color-sta)", label: (d) => d.part.statStamina },
  { key: "burst", color: "var(--color-bal)", label: (d) => d.part.statBurst },
];

export default function StatBars({
  stats,
  dict,
  compact = false,
}: {
  stats: Stats;
  dict: Dict;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-1" : "space-y-2.5"}>
      {BARS.map(({ key, color, label }) => (
        <div key={key} className="flex items-center gap-2">
          <span
            className={`shrink-0 text-ink-dim ${compact ? "w-10 text-[9px]" : "w-16 text-xs"}`}
          >
            {label(dict)}
          </span>
          <div className={`flex-1 overflow-hidden rounded-full bg-edge/60 ${compact ? "h-1" : "h-1.5"}`}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${stats[key] * 10}%`, background: color }}
            />
          </div>
          {!compact && (
            <span className="w-7 text-right font-display text-xs text-ink-dim">{stats[key]}</span>
          )}
        </div>
      ))}
    </div>
  );
}
