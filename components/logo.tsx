const BARS = [
  { x: 4.5, height: 8, opacity: 0.45 },
  { x: 9.75, height: 15, opacity: 0.72 },
  { x: 15, height: 22, opacity: 1 },
  { x: 20.25, height: 13, opacity: 0.72 },
  { x: 25.5, height: 7, opacity: 0.45 },
];

/**
 * The Convert mark: five bars of a sound wave. The favicon (public/icon.svg) is the same drawing.
 * With `active`, the bars beat (while a track plays or files convert).
 */
export function Logo({ size = 26, className = "", active = false }: { size?: number; className?: string; active?: boolean }) {
  return (
    <svg className={`logo ${active ? "is-active" : ""} ${className}`} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {BARS.map((bar, index) => (
        <rect
          key={bar.x}
          className="logo-bar"
          style={{ animationDelay: `${index * -0.17}s` }}
          x={bar.x}
          y={16 - bar.height / 2}
          width="2.9"
          height={bar.height}
          rx="1.45"
          fill="currentColor"
          fillOpacity={bar.opacity}
        />
      ))}
    </svg>
  );
}
