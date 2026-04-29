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
                Contratar mais gente nÃ£o resolve.
                <br />
                E ferramentas genÃ©ricas so acrescentam mais trabalho.
              </h2>
            </ScrollReveal>
          </div>

          <div className="space-y-8">
            <ScrollReveal delay={0.1}>
              <p className="text-base leading-relaxed text-text-secondary">
                Mais analistas, mais redatores, mais accounts significa mais onboarding, mais inconsistÃªncia e mais gente fazendo a mesma tarefa de formas diferentes. Cada um monta briefing do seu jeito. Cada um estrutura roteiro com a lÃ³gica que aprendeu no emprego anterior.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <p className="text-base leading-relaxed text-text-secondary">
                JÃ¡ as ferramentas de IA prontas — ChatGPT, Notion AI, templates de internet — nÃ£o entendem como sua agÃªncia funciona. Elas entregam textos genÃ©ricos, briefings incompletos e roteiros sem o tom do seu cliente. Depois alguem da equipe precisa refazer tudo do zero.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.3}>
              <p className="text-base leading-relaxed text-text-secondary">
                O que falta nÃ£o e mais gente ou mais tecnologia solta.
              </p>
              <p className="mt-2 text-base font-medium leading-relaxed text-text-primary">
                O que falta e um processo operacional padronizado, executado por agentes de IA que foram treinados exatamente no formato da sua agÃªncia.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
