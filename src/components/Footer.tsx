import { Dict } from "@/i18n";

export default function Footer({ dict }: { dict: Dict }) {
  return (
    <footer className="mt-16 border-t border-edge">
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-8 text-xs leading-relaxed text-ink-dim">
        <p>{dict.footer.disclaimer}</p>
        <p className="font-semibold text-ink-dim">{dict.footer.builtBy}</p>
      </div>
    </footer>
  );
}
