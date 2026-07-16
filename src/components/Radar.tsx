import { Dict } from "@/i18n";
import { Stats } from "@/data/parts";

/** Simple 4-axis SVG radar chart for combo stats. */
export default function Radar({ stats, dict }: { stats: Stats; dict: Dict }) {
  const size = 220;
  const c = size / 2;
  const rMax = size / 2 - 34;

  const axes: { key: keyof Stats; label: string }[] = [
    { key: "attack", label: dict.part.statAttack },
    { key: "defense", label: dict.part.statDefense },
    { key: "stamina", label: dict.part.statStamina },
    { key: "burst", label: dict.part.statBurst },
  ];

  const point = (i: number, r: number): [number, number] => {
    const angle = (Math.PI / 2) * i - Math.PI / 2;
    return [c + r * Math.cos(angle), c + r * Math.sin(angle)];
  };

  const poly = axes
    .map(({ key }, i) => point(i, (stats[key] / 10) * rMax).join(","))
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[240px]">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={axes.map((_, i) => point(i, rMax * f).join(",")).join(" ")}
          fill="none"
          stroke="var(--color-edge)"
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, rMax);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--color-edge)" strokeWidth={1} />;
      })}
      <polygon points={poly} fill="rgba(0,229,143,0.22)" stroke="var(--color-accent)" strokeWidth={2} />
      {axes.map(({ key }, i) => {
        const [x, y] = point(i, (stats[key] / 10) * rMax);
        return <circle key={key} cx={x} cy={y} r={3} fill="var(--color-accent)" />;
      })}
      {axes.map(({ key, label }, i) => {
        const [x, y] = point(i, rMax + 18);
        return (
          <text
            key={key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-ink-dim"
            fontSize={10}
          >
            {label} {stats[key]}
          </text>
        );
      })}
    </svg>
  );
}
