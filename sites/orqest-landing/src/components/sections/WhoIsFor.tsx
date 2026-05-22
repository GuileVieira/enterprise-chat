'use client';

import { ScrollReveal } from '@/components/ui/ScrollReveal';

const forYou = [
  'Sua equipe gasta mais tempo operando do que criando.',
  'Seu briefing varia de qualidade dependendo de quem monta.',
  'Você já tem processos, mas ninguém segue do mesmo jeito.',
  'Roteiros, pautas e planejamentos começam do zero a cada novo projeto.',
  'Sua equipe criativa está sobrecarregada com tarefas que não deveriam ser dela.',
];

const notForYou = [
  'Sua agência ainda não tem processo definido - primeiro precisa organizar a operação.',
  'Procura uma ferramenta pronta para usar sozinho - o Orqest inclui mapeamento e implementação feitos por especialistas.',
  'Sua equipe tem 2 pessoas e todo mundo faz tudo - ainda não há o que orquestrar.',
];

export function WhoIsFor() {
  return (
    <section className="bg-background py-32">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold leading-tight tracking-tighter text-text-primary md:text-4xl">
            Não é para todo mundo.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
          <ScrollReveal delay={0.1}>
            <div className="bg-surface rounded-[2rem] border border-black/10 p-8">
              <h3 className="mb-6 text-lg font-semibold tracking-tight text-text-primary">
                Orqest é para você se:
              </h3>
              <ul className="space-y-4">
                {forYou.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400/80" />
                    <span className="text-base leading-relaxed text-text-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="bg-surface rounded-[2rem] border border-black/10 p-8">
              <h3 className="mb-6 text-lg font-semibold tracking-tight text-text-primary">
                Não é para você se:
              </h3>
              <ul className="space-y-4">
                {notForYou.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-rose-400/80" />
                    <span className="text-base leading-relaxed text-text-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
