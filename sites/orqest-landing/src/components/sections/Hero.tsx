'use client';

import { motion } from "framer-motion";
import { MagneticButton } from "@/components/ui/MagneticButton";

interface HeroProps {
  onCtaClick: () => void;
}

export function Hero({ onCtaClick }: HeroProps) {
  return (
    <section className="relative flex min-h-[100dvh] items-center overflow-hidden bg-background">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-white/[0.03] blur-[120px]" />
      <div className="absolute bottom-0 left-0 -z-10 h-[500px] w-[500px] rounded-full bg-white/[0.02] blur-[100px]" />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-32 md:grid-cols-[55fr_45fr] md:gap-8">
        <div className="flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
          >
            <h1 className="max-w-[18ch] text-5xl font-bold tracking-tight text-text-primary md:text-6xl lg:text-7xl leading-[1.05]">
              Recupere metade do dia da sua equipe criativa sem contratar ninguém.
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
            className="mt-8 max-w-[45ch] text-xl leading-relaxed text-text-secondary"
          >
            A Orqest mapeia como sua agência trabalha e instala operação digital no seu processo: briefing completo em 5 minutos, roteiro estruturado em 10, planejamento e relatórios sem fila. Sua equipe usa quando precisa. E volta a criar.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
            className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
          >
            <MagneticButton
              onClick={onCtaClick}
              className="border border-white/20 bg-white/[0.06] text-text-primary backdrop-blur-sm hover:border-white/30 hover:bg-white/10"
            >
              Mapear meus processos gratuitamente
            </MagneticButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex items-center gap-3"
          >
            <div className="flex -space-x-2">
              {[
                'from-amber-200/30 to-orange-300/20',
                'from-emerald-200/30 to-teal-300/20',
                'from-sky-200/30 to-indigo-300/20',
                'from-rose-200/30 to-pink-300/20',
              ].map((grad, i) => (
                <div
                  key={i}
                  className={`h-8 w-8 rounded-full border-2 border-background bg-gradient-to-br ${grad}`}
                />
              ))}
            </div>
            <p className="text-sm text-text-muted">
              Processos validados em mais de 45 segmentos. Adaptados para agências de criação.
            </p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 text-sm font-bold uppercase tracking-widest text-text-muted"
          >
            Para agências que já têm talento, mas perdem tempo no operacional.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.4 }}
          className="relative hidden items-center justify-center md:flex"
        >
          <div className="relative w-full max-w-md">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Briefing", icon: "B", delay: 0 },
                { label: "Roteiro", icon: "R", delay: 0.1 },
                { label: "Planejamento", icon: "P", delay: 0.2 },
                { label: "Relatórios", icon: "D", delay: 0.3 },
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
                  className="group rounded-3xl border border-white/10 bg-surface p-6 transition-all hover:border-white/20"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-lg font-bold text-text-primary transition-colors group-hover:bg-white/10">
                    {item.icon}
                  </div>
                  <div className="text-base font-bold text-text-primary">{item.label}</div>
                  <div className="mt-2 h-1.5 w-12 rounded-full bg-white/10 transition-all group-hover:w-20 group-hover:bg-white/20" />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
