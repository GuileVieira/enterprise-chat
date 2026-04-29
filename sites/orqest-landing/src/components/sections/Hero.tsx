'use client';

import { motion } from 'framer-motion';
import { MagneticButton } from '@/components/ui/MagneticButton';

interface HeroProps {
  onCtaClick: () => void;
}

export function Hero({ onCtaClick }: HeroProps) {
  const operations = [
    { label: 'Briefing', metric: '05 min', note: 'contexto fechado' },
    { label: 'Roteiro', metric: '11 min', note: 'estrutura aprovada' },
    { label: 'Pautas', metric: '32 ideias', note: 'mês organizado' },
    { label: 'Relatório', metric: '8 fontes', note: 'insight pronto' },
  ];

  return (
    <section className="relative flex min-h-[100dvh] items-center overflow-hidden bg-background">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_72%_18%,rgba(158,163,106,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_42%)]" />

      {/* Concentric rings from favicon texture */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 60, damping: 20, delay: 0.6 }}
        className="pointer-events-none absolute right-[8%] top-[12%] hidden lg:block"
      >
        <svg width="180" height="180" viewBox="0 0 100 100" fill="none" className="opacity-[0.18]">
          <circle
            cx="50"
            cy="50"
            r="48"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-text-primary"
          />
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-text-primary"
          />
          <circle
            cx="50"
            cy="50"
            r="28"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-text-primary"
          />
          <circle
            cx="50"
            cy="50"
            r="18"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-text-primary"
          />
          <circle
            cx="50"
            cy="50"
            r="8"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-text-primary"
          />
          <motion.circle
            cx="50"
            cy="50"
            r="48"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-moss"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.5, ease: 'easeInOut', delay: 1 }}
          />
        </svg>
      </motion.div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-28 sm:px-6 md:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] md:gap-10 lg:py-36">
        <div className="flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.1 }}
          >
            <p className="border-moss/70 text-moss mb-5 max-w-max border-l pl-3 font-mono text-xs uppercase tracking-[0.22em]">
              Operação instalada para agências
            </p>
            <h1 className="max-w-[18ch] text-5xl font-semibold leading-[0.98] tracking-tighter text-text-primary md:text-6xl lg:text-7xl">
              Recupere metade do dia da sua equipe criativa sem contratar ninguém.
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.2 }}
            className="mt-8 max-w-[48ch] text-lg leading-relaxed text-text-secondary md:text-xl"
          >
            A Orqest mapeia como sua agência trabalha e instala operação digital no seu processo:
            briefing completo em 5 minutos, roteiro estruturado em 10, planejamento e relatórios sem
            fila. Sua equipe usa quando precisa. E volta a criar.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.3 }}
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
            className="mt-10 grid max-w-xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4"
          >
            {operations.map((item) => (
              <div key={item.label} className="bg-background/80 p-4">
                <p className="text-text-muted font-mono text-[11px] uppercase tracking-[0.18em]">
                  {item.label}
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-text-primary">
                  {item.metric}
                </p>
                <p className="text-text-muted mt-1 text-xs">{item.note}</p>
              </div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-text-muted mt-8 text-sm font-bold uppercase tracking-widest"
          >
            Para agências que já têm talento, mas perdem tempo no operacional.
          </motion.p>
        </div>

        <motion.aside
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 80, damping: 20, delay: 0.4 }}
          className="relative hidden items-center justify-center md:flex"
        >
          <div className="relative w-full max-w-[520px]">
            <div className="bg-[#b8abd8]/8 absolute -left-7 top-12 h-44 w-36 rounded-[2rem] border border-[#b8abd8]/20" />
            <div className="relative overflow-hidden rounded-[2.25rem] border border-white/[0.12] bg-[#15141c] p-6 shadow-[0_32px_70px_-34px_rgba(0,0,0,0.72)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(184,171,216,0.22),transparent_34%)]" />
              <div className="relative">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#b8abd8]">
                      Operação instalada
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
                      Fluxo de entrega
                    </p>
                  </div>
                  <motion.div
                    animate={{ opacity: [0.55, 1, 0.55] }}
                    transition={{ repeat: Infinity, duration: 2.6 }}
                    className="h-2.5 w-2.5 rounded-full bg-[#b8abd8]"
                  />
                </div>

                <div className="mt-6 grid grid-cols-[0.82fr_1.18fr] gap-4">
                  <div className="space-y-3">
                    {['Briefing', 'Roteiro', 'Pauta'].map((item, index) => (
                      <motion.div
                        key={item}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          type: 'spring',
                          stiffness: 100,
                          damping: 20,
                          delay: 0.55 + index * 0.1,
                        }}
                        className="rounded-2xl border border-white/[0.12] bg-white/[0.045] p-4"
                      >
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#b8abd8]">
                          agente
                        </p>
                        <p className="mt-2 text-lg font-semibold tracking-tight text-text-primary">
                          {item}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="bg-background/58 rounded-[1.6rem] border border-white/[0.12] p-5">
                    <p className="text-text-muted font-mono text-xs uppercase tracking-[0.18em]">
                      Saída padrão
                    </p>
                    <div className="mt-5 space-y-4">
                      {[
                        'Objetivo e contexto',
                        'Formato da agência',
                        'Critérios de revisão',
                        'Entrega pronta',
                      ].map((item, index) => (
                        <div key={item} className="flex items-center gap-3">
                          <span className="bg-[#b8abd8]/14 grid h-7 w-7 place-items-center rounded-lg font-mono text-xs text-[#b8abd8]">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="text-sm text-text-secondary">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.aside>
      </div>
    </section>
  );
}
