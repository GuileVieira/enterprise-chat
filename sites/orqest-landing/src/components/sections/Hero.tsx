'use client';

import { motion } from "framer-motion";
import { MagneticButton } from "@/components/ui/MagneticButton";

interface HeroProps {
  onCtaClick: () => void;
}

export function Hero({ onCtaClick }: HeroProps) {
  return (
    <section className="relative flex min-h-[100dvh] items-center overflow-hidden bg-background">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-32 md:grid-cols-[55fr_45fr] md:gap-8">
        <div className="flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
          >
            <h1 className="max-w-[16ch] text-4xl font-semibold tracking-tighter text-text-primary md:text-5xl lg:text-6xl leading-[1.1]">
              Sua equipe criativa gasta metade do dia em tarefas que nao deveria fazer.
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
            className="mt-6 max-w-[50ch] text-lg leading-relaxed text-text-secondary"
          >
            O Orqest mapeia como sua agencia trabalha e entrega um time de agentes de IA especializados no dia a dia da sua operacao: briefing, roteiro, planejamento, relatorios. Sua equipe usa quando precisa. E volta a focar no que importa.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
            className="mt-10"
          >
            <MagneticButton onClick={onCtaClick}>
              Ver como funciona na minha agencia
            </MagneticButton>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-sm text-text-muted"
          >
            Para agencias de marketing que ja tem talento, mas perdem tempo em processos operacionais que deveriam ser instantaneos.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.4 }}
          className="relative hidden items-center justify-center md:flex"
        >
          <div className="relative w-full max-w-md">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Briefing", icon: "B", delay: 0 },
                { label: "Roteiro", icon: "R", delay: 0.1 },
                { label: "Pauta", icon: "P", delay: 0.2 },
                { label: "Dados", icon: "D", delay: 0.3 },
              ].map((item) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 100,
                    damping: 20,
                    delay: 0.5 + item.delay,
                  }}
                  className="rounded-2xl border border-slate-200/50 bg-white p-4 shadow-diffusion"
                >
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 3 + item.delay,
                      ease: "easeInOut",
                    }}
                  >
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-text-primary">
                      {item.icon}
                    </div>
                    <div className="text-sm font-medium text-text-primary">{item.label}</div>
                    <div className="mt-1 h-2 w-16 rounded-full bg-slate-100" />
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
