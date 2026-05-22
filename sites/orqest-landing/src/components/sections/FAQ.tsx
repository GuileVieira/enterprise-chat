'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
// import { cn } from "@/lib/utils";

const faqs = [
  {
    question: 'Mas o resultado da IA não tem a qualidade da minha equipe.',
    answer:
      'O agente não substitui o julgamento criativo. Ele acelera a parte operacional: estrutura, formato, pesquisa, organização. O redator ainda edita. O planejador ainda aprova. Só que começam de um ponto 80% pronto, não do zero.',
  },
  {
    question: 'Meus clientes vão perceber que usamos IA.',
    answer:
      'Os agentes usam o tom, o formato e as referências que você define. O objetivo não é enganar ninguém - é garantir que a entrega operacional não dependa de qual pessoa da equipe está disponível no momento.',
  },
  {
    question: 'E se eu já tiver templates e processos?',
    answer:
      'Melhor ainda. Transformamos seus templates em agentes inteligentes que preenchem, adaptam e entregam no contexto de cada cliente. Seu processo vira tecnologia, não fica no papel.',
  },
  {
    question: 'Como eu sei se está funcionando?',
    answer:
      'Você acompanha tudo em um dashboard: quantas entregas cada agente gerou, tempo médio de uso, avaliação de qualidade pela equipe. E fazemos reuniões mensais de ajuste baseadas nos números.',
  },
  {
    question: 'E se eu quiser cancelar?',
    answer:
      'Não temos fidelidade. Mas o cancelamento só faz sentido se a operação estiver tão padronizada que você não precisa mais de nós - e nesse caso, parabéns.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-surface py-32">
      <div className="mx-auto max-w-3xl px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold leading-tight tracking-tighter text-text-primary md:text-4xl">
            Perguntas frequentes.
          </h2>
        </ScrollReveal>

        <div className="mt-12 space-y-0">
          {faqs.map((faq, i) => (
            <ScrollReveal key={i} delay={0.05 * (i + 1)}>
              <div className="border-t border-black/10">
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="flex w-full items-center justify-between rounded-lg py-6 text-left transition-colors hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="pr-8 text-base font-medium text-text-primary">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: openIndex === i ? 45 : 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className="flex-shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 2V14M2 8H14"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                      className="overflow-hidden"
                    >
                      <p className="pb-6 text-base leading-relaxed text-text-secondary">
                        {faq.answer}
                      </p>
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
