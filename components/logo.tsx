/** The Convert mark: three layers of sound, stacked. The favicon (public/icon.svg) is the same drawing. */
export function Logo({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`logo ${className}`} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 15.5 28.5 22 16 28.5 3.5 22Z" stroke="currentColor" strokeOpacity=".32" strokeWidth="1.7" strokeLinejoin="round" className="logo-fill" />
      <path d="M16 9.5 28.5 16 16 22.5 3.5 16Z" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.7" strokeLinejoin="round" className="logo-fill" />
      <path d="M16 3.5 28.5 10 16 16.5 3.5 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="logo-fill" />
    </svg>
  );
}
