'use client';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
// import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "Mas o resultado da IA nÃ£o tem a qualidade da minha equipe.",
    answer:
      "O agente nÃ£o substitui o julgamento criativo. Ele acelera a parte operacional: estrutura, formato, pesquisa, organizaÃ§Ã£o. O redator ainda edita. O planejador ainda aprova. SÃ³ que comeÃ§am de um ponto 80% pronto, nÃ£o do zero.",
  },
  {
    question: "Meus clientes vao perceber que usamos IA.",
    answer:
      "Os agentes usam o tom, o formato e as referÃªncias que vocÃª define. O objetivo nÃ£o e enganar ninguÃ©m — e garantir que a entrega operacional nÃ£o dependa de qual pessoa da equipe esta disponÃ­vel no momento.",
  },
  {
    question: "E se eu jÃ¡ tiver templates e processos?",
    answer:
      "Melhor ainda. Transformamos seus templates em agentes inteligentes que preenchem, adaptam e entregam no contexto de cada cliente. Seu processo vira tecnologia, nÃ£o fica no papel.",
  },
  {
    question: "Como eu sei se esta funcionando?",
    answer:
      "VocÃª acompanha tudo em um dashboard: quantas entregas cada agente gerou, tempo mÃ©dio de uso, avaliaÃ§Ã£o de qualidade pela equipe. E fazemos reuniÃµes mensais de ajuste baseadas nos nÃºmeros.",
  },
  {
    question: "E se eu quiser cancelar?",
    answer:
      "NÃ£o temos fidelidade. Mas o cancelamento sÃ³ faz sentido se a operaÃ§Ã£o estiver tÃ£o padronizada que vocÃª nÃ£o precisa mais de nos — e nesse caso, parabÃ©ns.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-slate-50 py-32">
      <div className="mx-auto max-w-3xl px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold tracking-tighter text-text-primary md:text-4xl leading-tight">
            Perguntas frequentes.
          </h2>
        </ScrollReveal>

        <div className="mt-12 space-y-0">
          {faqs.map((faq, i) => (
            <ScrollReveal key={i} delay={0.05 * (i + 1)}>
              <div className="border-t border-slate-200/50">
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="flex w-full items-center justify-between py-6 text-left transition-colors"
                >
                  <span className="pr-8 text-base font-medium text-text-primary">{faq.question}</span>
                  <motion.div
                    animate={{ rotate: openIndex === i ? 45 : 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="flex-shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2V14M2 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 100, damping: 20 }}
                      className="overflow-hidden"
                    >
                      <p className="pb-6 text-base leading-relaxed text-text-secondary">{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
