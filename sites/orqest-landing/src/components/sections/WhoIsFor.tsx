'use client';

import { ScrollReveal } from "@/components/ui/ScrollReveal";

const forYou = [
  "Sua equipe gasta mais tempo operando do que criando.",
  "Seu briefing varia de qualidade dependendo de quem monta.",
  "Voce ja tem processos, mas ninguem segue do mesmo jeito.",
  "Roteiros, pautas e planejamentos comecam do zero a cada novo projeto.",
  "Sua equipe criativa esta sobrecarregada com tarefas que nao deveriam ser dela.",
];

const notForYou = [
  "Sua agencia ainda nao tem processo definido — primeiro precisa organizar a operacao.",
  "Procura uma ferramenta pronta para usar sozinho — o Orqest inclui mapeamento e implementacao feitos por especialistas.",
  "Sua equipe tem 2 pessoas e todo mundo faz tudo — ainda nao ha o que orquestrar.",
];

export function WhoIsFor() {
  return (
    <section className="bg-background py-32">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold tracking-tighter text-text-primary md:text-4xl leading-tight">
            Nao e para todo mundo.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
          <ScrollReveal delay={0.1}>
            <div className="rounded-[2rem] border border-slate-200/50 bg-white p-8 shadow-diffusion">
              <h3 className="mb-6 text-lg font-semibold tracking-tight text-text-primary">
                Orqest e para voce se:
              </h3>
              <ul className="space-y-4">
                {forYou.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-green-600" />
                    <span className="text-base leading-relaxed text-text-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="rounded-[2rem] border border-slate-200/50 bg-white p-8 shadow-diffusion">
              <h3 className="mb-6 text-lg font-semibold tracking-tight text-text-primary">
                Nao e para voce se:
              </h3>
              <ul className="space-y-4">
                {notForYou.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
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
