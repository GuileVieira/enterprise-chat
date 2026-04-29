'use client';

import { motion } from "framer-motion";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

const steps = [
  {
    number: "01",
    title: "Mapeamento",
    description:
      "Entrevistamos sua lideranÃ§a e equipe operacional. Documentamos como vocÃªs montam briefing, escrevem roteiro, planejam campanha, estruturam pauta e geram relatÃ³rios. Identificamos onde a IA pode assumir sem perder o padrÃ£o de qualidade.",
  },
  {
    number: "02",
    title: "Orquestracao",
    description:
      "Criamos cada agente com o contexto da sua agÃªncia: formatos aprovados, tom de voz por cliente, templates histÃ³ricos, regras de negÃ³cio. Integramos com as ferramentas que vocÃª jÃ¡ usa, se necessÃ¡rio.",
  },
  {
    number: "03",
    title: "Conducao",
    description:
      "A equipe comeca a usar. VocÃª acompanha a adoÃ§Ã£o e a qualidade das entregas em um dashboard. Nos ajustamos os agentes conforme a agÃªncia evolui — novos clientes, novos formatos, novos processos.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-background py-32">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold tracking-tighter text-text-primary md:text-4xl leading-tight">
            De operaÃ§Ã£o bagunÃ§ada para processo orquestrado em 3 fases.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <ScrollReveal key={step.number} delay={0.1 * (i + 1)}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="rounded-[2rem] border border-slate-200/50 bg-white p-8 shadow-diffusion"
              >
                <div className="mb-6 font-mono text-5xl font-semibold tracking-tighter text-slate-200">
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
