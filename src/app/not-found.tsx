import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="font-display text-6xl font-black text-accent text-glow">404</div>
      <div className="font-display text-xl font-bold tracking-widest">
        LOST IN THE XTREME ZONE
      </div>
      <p className="text-sm text-ink-dim">This page burst out of the stadium. · 这个页面已经爆裂飞出场外。</p>
      <Link
        href="/en"
        className="clip-x mt-2 bg-accent px-6 py-3 font-display text-sm font-bold tracking-wider text-bg"
      >
        SPINDEX →
      </Link>
    </div>
  );
}
