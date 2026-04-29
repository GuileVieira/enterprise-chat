'use client';

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

const steps = [
  {
    number: "01",
    title: "Mapeamento",
    description:
      "Entrevistamos sua liderança e equipe operacional. Documentamos como vocês montam briefing, escrevem roteiro, planejam campanha, estruturam pauta e geram relatórios. Identificamos onde a IA pode assumir sem perder o padrão de qualidade.",
  },
  {
    number: "02",
    title: "Instalação",
    description:
      "Criamos cada operação com o contexto da sua agência: formatos aprovados, tom de voz por cliente, templates históricos, regras de negócio. Integramos com as ferramentas que você já usa, se necessário.",
  },
  {
    number: "03",
    title: "Acompanhamento",
    description:
      "A equipe começa a usar. Você acompanha a adoção e a qualidade das entregas em um dashboard. Ajustamos as operações conforme a agência evolui — novos clientes, novos formatos, novos processos.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-background py-32">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold tracking-tighter text-text-primary md:text-4xl leading-tight">
            De operação bagunçada para entregas automáticas em 3 fases.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 md:grid-rows-2">
          {steps.map((step, i) => (
            <ScrollReveal
              key={step.number}
              delay={0.1 * (i + 1)}
              className={i === 0 ? "md:row-span-2" : ""}
            >
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className={cn(
                  "h-full rounded-[2rem] border border-black/10 bg-surface p-8",
                  i === 0 ? "md:p-10" : ""
                )}
              >
                <div className="mb-6 font-mono text-5xl font-semibold tracking-tighter text-text-muted/30">
                  {step.number}
                </div>
                <h3 className="mb-4 text-xl font-semibold tracking-tight text-text-primary">
                  {step.title}
                </h3>
                <p className="text-base leading-relaxed text-text-secondary">
                  {step.description}
                </p>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
