export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-background py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-10 md:flex-row">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#fafaf9"/>
                  <stop offset="100%" stop-color="#818cf8"/>
                </linearGradient>
              </defs>
              <path d="M10 50C10 27.9 27.9 10 50 10C65 10 80 20 85 30C70 15 45 15 30 30C15 45 15 65 30 80C18 75 10 65 10 50Z" fill="#fafaf9"/>
              <path d="M90 50C90 72.1 72.1 90 50 90C35 90 20 80 15 70C30 85 55 85 70 70C85 55 85 35 70 20C82 25 90 35 90 50Z" fill="url(#grad)"/>
              <path d="M25 50C25 40 35 25 50 25" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.15"/>
              <path d="M75 50C75 60 65 75 50 75" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.15"/>
              <path d="M15 50C15 35 25 20 45 15" stroke="#fafaf9" strokeWidth="0.5" strokeLinecap="round" strokeOpacity="0.3"/>
              <path d="M85 50C85 65 75 80 55 85" stroke="#818cf8" strokeWidth="0.5" strokeLinecap="round" strokeOpacity="0.4"/>
            </svg>
            <span className="text-base font-bold tracking-tight text-text-primary">Orqest</span>
          </div>
          <div className="flex flex-col items-center gap-2 md:items-end">
            <p className="text-sm font-bold text-text-primary">
              Agentes de IA para operação interna de agências.
            </p>
            <p className="text-xs font-medium text-text-muted">
              © {new Date().getFullYear()} Orqest. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
