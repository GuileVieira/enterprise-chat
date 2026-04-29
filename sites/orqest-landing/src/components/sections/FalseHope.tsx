'use client';

import { ScrollReveal } from "@/components/ui/ScrollReveal";

export function FalseHope() {
  return (
    <section className="bg-slate-50 py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 items-start gap-16 md:grid-cols-2">
          <div>
            <ScrollReveal>
              <h2 className="text-3xl font-semibold tracking-tighter text-text-primary md:text-4xl leading-tight">
                Contratar mais gente não resolve.
                <br />
                E ferramentas genéricas so acrescentam mais trabalho.
              </h2>
            </ScrollReveal>
          </div>

          <div className="space-y-8">
            <ScrollReveal delay={0.1}>
              <p className="text-base leading-relaxed text-text-secondary">
                Mais analistas, mais redatores, mais accounts significa mais onboarding, mais inconsistência e mais gente fazendo a mesma tarefa de formas diferentes. Cada um monta briefing do seu jeito. Cada um estrutura roteiro com a lógica que aprendeu no emprego anterior.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <p className="text-base leading-relaxed text-text-secondary">
                Já as ferramentas de IA prontas - ChatGPT, Notion AI, templates de internet - não entendem como sua agência funciona. Elas entregam textos genéricos, briefings incompletos e roteiros sem o tom do seu cliente. Depois alguém da equipe precisa refazer tudo do zero.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.3}>
              <p className="text-base leading-relaxed text-text-secondary">
                O que falta não e mais gente ou mais tecnologia solta.
              </p>
              <p className="mt-2 text-base font-medium leading-relaxed text-text-primary">
                O que falta e um processo operacional padronizado, executado por agentes de IA que foram treinados exatamente no formato da sua agência.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
