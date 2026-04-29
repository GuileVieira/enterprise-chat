export function Footer() {
  return (
    <footer className="border-t border-slate-200/50 bg-background py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-text-primary">Orqest</span>
          </div>
          <p className="text-sm text-text-muted">
            Orqest — Agentes de IA para operacao interna de agencias.
          </p>
          <p className="text-sm text-text-muted">
            {new Date().getFullYear()} Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
