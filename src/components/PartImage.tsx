export default function PartImage({
  src,
  alt,
  fallbackLabel,
  color = "var(--color-accent)",
  className = "",
}: {
  src: string | null;
  alt: string;
  fallbackLabel: string;
  color?: string;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`h-full w-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)] ${className}`}
      />
    );
  }
  return (
    <div className={`flex h-full w-full items-center justify-center ${className}`}>
      <span
        className="font-display text-3xl font-bold opacity-60"
        style={{ color }}
      >
        {fallbackLabel}
      </span>
    </div>
  );
}
