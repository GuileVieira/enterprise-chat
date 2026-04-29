'use client';

import { motion } from "framer-motion";
import { MagneticButton } from "@/components/ui/MagneticButton";

interface ClosingProps {
  onCtaClick: () => void;
}

export function Closing({ onCtaClick }: ClosingProps) {
  return (
    <section className="relative flex min-h-[80dvh] items-center overflow-hidden bg-text-primary">
      <div className="mx-auto max-w-4xl px-6 py-32 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="text-3xl font-semibold tracking-tighter text-white md:text-5xl leading-tight"
        >
          Sua equipe nÃ£o tem tempo para criar porque esta ocupada operando.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
          className="mt-8 text-lg leading-relaxed text-white/60"
        >
          Agende um diagnostico gratuito de 30 minutos. Vamos mapear seus processos operacionais e mostrar exatamente quais tarefas podem ser executadas por agentes de IA antes que vocÃª gaste 1 real.
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
            className="bg-white text-text-primary hover:bg-white/90"
          >
            Agendar meu diagnostico gratuito
          </MagneticButton>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-sm text-white/40"
        >
          Sem apresentaÃ§Ã£o generica. VocÃª vai sair da call com um mapa dos gargalos da sua operaÃ§Ã£o e pelo menos 3 tarefas que um agente pode assumir imediatamente.
        </motion.p>
      </div>
    </section>
  );
}
