import { Metadata } from "next";
import { MagneticButton } from "@/components/ui/MagneticButton";

export const metadata: Metadata = {
  title: "Obrigado — Orqest",
  description: "Obrigado por se interessar no Orqest. Agende sua reuniÃ£o de diagnÃ³stico gratuito.",
};

export default function ObrigadoPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M5 12L10 17L19 8" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className="text-3xl font-semibold tracking-tighter text-text-primary md:text-4xl leading-tight">
          Obrigado por se interessar no Orqest
        </h1>

        <p className="mt-6 text-lg leading-relaxed text-text-secondary">
          Baseado nas suas respostas, vocÃª e um bom fit para o Orqest. Agende agora sua reuniÃ£o de 30 minutos para mapearmos sua operaÃ§Ã£o.
        </p>

        <div className="mt-10">
          <MagneticButton href="https://cal.com/orqest/diagnostico">
            Agendar minha reuniÃ£o de 30 minutos
          </MagneticButton>
        </div>

        <p className="mt-6 text-sm text-text-muted">
          Ou, se preferir, baixe nosso guia de processos operacionais para agÃªncias.
        </p>

        <div className="mt-4">
          <a
            href="#"
            className="inline-flex items-center justify-center rounded-full border border-slate-200/50 px-6 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-slate-50"
          >
            Baixar guia gratuito
          </a>
        </div>
      </div>
    </main>
  );
}
