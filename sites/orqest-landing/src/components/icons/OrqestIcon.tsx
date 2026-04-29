export function OrqestIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="orqest-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fafaf9" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <path
        d="M10 50C10 27.9 27.9 10 50 10C65 10 80 20 85 30C70 15 45 15 30 30C15 45 15 65 30 80C18 75 10 65 10 50Z"
        fill="#fafaf9"
      />
      <path
        d="M90 50C90 72.1 72.1 90 50 90C35 90 20 80 15 70C30 85 55 85 70 70C85 55 85 35 70 20C82 25 90 35 90 50Z"
        fill="url(#orqest-grad)"
      />
      <path
        d="M25 50C25 40 35 25 50 25"
        stroke="#fafaf9"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.3"
      />
      <path
        d="M75 50C75 60 65 75 50 75"
        stroke="#fafaf9"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.3"
      />
      <path
        d="M15 50C15 35 25 20 45 15"
        stroke="#fafaf9"
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
      <path
        d="M85 50C85 65 75 80 55 85"
        stroke="#818cf8"
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
    </svg>
  );
}