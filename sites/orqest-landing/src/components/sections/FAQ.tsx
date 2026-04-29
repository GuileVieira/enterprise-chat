'use client';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
// import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "Mas o resultado da IA nao tem a qualidade da minha equipe.",
    answer:
      "O agente nao substitui o julgamento criativo. Ele acelera a parte operacional: estrutura, formato, pesquisa, organizacao. O redator ainda edita. O planejador ainda aprova. So que comecam de um ponto 80% pronto, nao do zero.",
  },
  {
    question: "Meus clientes vao perceber que usamos IA.",
    answer:
      "Os agentes usam o tom, o formato e as referencias que voce define. O objetivo nao e enganar ninguem — e garantir que a entrega operacional nao dependa de qual pessoa da equipe esta disponivel no momento.",
  },
  {
    question: "E se eu ja tiver templates e processos?",
    answer:
      "Melhor ainda. Transformamos seus templates em agentes inteligentes que preenchem, adaptam e entregam no contexto de cada cliente. Seu processo vira tecnologia, nao fica no papel.",
  },
  {
    question: "Como eu sei se esta funcionando?",
    answer:
      "Voce acompanha tudo em um dashboard: quantas entregas cada agente gerou, tempo medio de uso, avaliacao de qualidade pela equipe. E fazemos reunioes mensais de ajuste baseadas nos numeros.",
  },
  {
    question: "E se eu quiser cancelar?",
    answer:
      "Nao temos fidelidade. Mas o cancelamento so faz sentido se a operacao estiver tao padronizada que voce nao precisa mais de nos — e nesse caso, parabens.",
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
