'use client';

import { ScrollReveal } from "@/components/ui/ScrollReveal";

const results = [
  "Briefing completo em 5 minutos, nÃ£o em 2 horas.",
  "Roteiro de video estruturado no padrÃ£o da agÃªncia, entregue em minutos.",
  "Planejamento de campanha com esqueleto, publico e cronograma — pronto para revisÃ£o, nÃ£o para comeÃ§ar do zero.",
  "Pautas de conteÃºdo para o mÃªs inteiro geradas em uma manhÃ£.",
  "Relatorios e insights de dados respondidos instantaneamente, sem fila.",
  "Padronizacao de qualidade: nÃ£o importa quem esta usando o agente, a entrega sai no mesmo formato.",
];

export function Proof() {
  return (
    <section className="bg-slate-50 py-32">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold tracking-tighter text-text-primary md:text-4xl leading-tight">
            O que muda quando a operaÃ§Ã£o para de depender da memÃ³ria da equipe.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {results.map((result, i) => (
            <ScrollReveal key={i} delay={0.08 * (i + 1)}>
              <div className="rounded-[2rem] border border-slate-200/50 bg-white p-8 shadow-diffusion">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-text-primary">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-base leading-relaxed text-text-secondary">{result}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.6}>
          <p className="mt-12 text-sm text-text-muted">
            Baseado em processos de agÃªncias validados em mapeamentos operacionais. A lÃ³gica e a mesma usada por consultorias de processos — so que executada por IA no dia a dia da sua equipe.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
