'use client';

import { ScrollReveal } from '@/components/ui/ScrollReveal';

const results = [
  'Briefing completo em 5 minutos, não em 2 horas.',
  'Roteiro de vídeo estruturado no padrão da agência, entregue em minutos.',
  'Planejamento de campanha com esqueleto, público e cronograma - pronto para revisão, não para começar do zero.',
  'Pautas de conteúdo para o mês inteiro geradas em uma manhã.',
  'Relatórios e insights de dados respondidos instantaneamente, sem fila.',
  'Padronização de qualidade: não importa quem está usando o agente, a entrega sai no mesmo formato.',
];

export function Proof() {
  return (
    <section className="bg-surface py-32">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal>
          <p className="text-text-muted text-sm font-medium uppercase tracking-widest">
            Resultados de agências em implantação
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tighter text-text-primary md:text-4xl">
            O que muda quando a operação para de depender da memória da equipe.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {results.map((result, i) => (
            <ScrollReveal key={i} delay={0.08 * (i + 1)}>
              <div className="bg-surface rounded-[2rem] border border-black/10 p-8">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6L5 9L10 3"
                        stroke="#4ade80"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p className="text-base leading-relaxed text-text-secondary">{result}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.6}>
          <p className="text-text-muted mt-12 text-sm">
            Baseado em processos de agências validados em mapeamentos operacionais. A lógica é a
            mesma usada por consultorias de processos — só que executada por IA no dia a dia da sua
            equipe.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
