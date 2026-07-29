export function OrqestLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <text
        x="0"
        y="24"
        fill="currentColor"
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        fontSize="28"
        fontWeight="600"
        letterSpacing="-0.04em"
      >
        Orqest
      </text>
    </svg>
  );
}
