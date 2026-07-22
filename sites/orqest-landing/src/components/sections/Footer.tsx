import { OrqestIcon } from '@/components/icons/OrqestIcon';
import { OrqestLogo } from '@/components/icons/OrqestLogo';

export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-background py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-10 md:flex-row">
          <div className="flex items-center gap-2">
            <OrqestIcon className="h-7 w-7" />
            <OrqestLogo className="h-5 w-[76px] text-text-primary" />
          </div>
          <div className="flex flex-col items-center gap-2 md:items-end">
            <p className="text-sm font-bold text-text-primary">
              Agentes de IA para operação interna de agências.
            </p>
            <p className="text-text-muted text-xs font-medium">
              © {new Date().getFullYear()} Orqest. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
