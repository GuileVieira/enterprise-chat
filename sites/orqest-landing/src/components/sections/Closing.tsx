'use client';

import { motion } from "framer-motion";
import { MagneticButton } from "@/components/ui/MagneticButton";

interface ClosingProps {
  onCtaClick: () => void;
}

export function Closing({ onCtaClick }: ClosingProps) {
  return (
    <section className="relative flex min-h-[80dvh] items-center overflow-hidden bg-surface">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/[0.02] blur-[120px]" />
      </div>
      <div className="mx-auto max-w-4xl px-6 py-32 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="text-3xl font-semibold tracking-tighter text-text-primary md:text-5xl leading-tight"
        >
          Sua equipe não tem tempo para criar porque está ocupada operando.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
          className="mt-8 text-lg leading-relaxed text-text-secondary"
        >
          Agende um diagnóstico gratuito de 30 minutos. Vamos mapear seus processos operacionais e mostrar exatamente quais tarefas podem ser executadas por agentes de IA antes que você gaste 1 real.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
          className="mt-12"
        >
          <MagneticButton
            onClick={onCtaClick}
            className="bg-text-primary text-background hover:bg-accent-hover"
          >
            Agendar meu diagnóstico gratuito
          </MagneticButton>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-sm text-text-muted"
        >
          Sem apresentação genérica. Você vai sair da call com um mapa dos gargalos da sua operação e pelo menos 3 tarefas que um agente pode assumir imediatamente.
        </motion.p>
      </div>
    </section>
  );
}
