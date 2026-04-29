'use client';

import { motion, animate } from 'framer-motion';
import { useEffect, useState, memo } from 'react';

// Briefing Simulation - Typewriter filling fields
export const BriefingSimulation = memo(function BriefingSimulation() {
  const [text, setText] = useState('');
  const fullText = 'Objetivo: Aumentar leads qualificados em 40% até Q3';

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setText(fullText.slice(0, i));
        i++;
      } else {
        setTimeout(() => {
          i = 0;
          setText('');
        }, 2000);
      }
    }, 60);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full flex-col justify-center bg-background/55 p-4">
      <div className="text-text-muted mb-3 font-mono text-sm">BRIEFING_CAMPANHA_Q3.md</div>
      <div className="space-y-2">
        <div className="bg-surface-raised/70 rounded-lg border border-black/[0.12] p-3">
          <div className="text-text-muted mb-1 font-mono text-xs uppercase">Objetivo</div>
          <div className="text-base text-text-primary">
            {text}
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="inline-block w-0.5 bg-text-primary"
            >
              |
            </motion.span>
          </div>
        </div>
        <div className="bg-surface-raised/70 rounded-lg border border-black/[0.12] p-3 opacity-70">
          <div className="text-text-muted mb-1 font-mono text-xs uppercase">Público-alvo</div>
          <div className="h-4 w-3/4 rounded bg-black/15" />
        </div>
        <div className="bg-surface-raised/70 rounded-lg border border-black/[0.12] p-3 opacity-55">
          <div className="text-text-muted mb-1 font-mono text-xs uppercase">Tom de voz</div>
          <div className="h-4 w-1/2 rounded bg-black/15" />
        </div>
      </div>
    </div>
  );
});

// Roteiro Simulation - Staggered text highlight
export const RoteiroSimulation = memo(function RoteiroSimulation() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sections = [
    { label: 'GANCHO', text: 'Você já perdeu uma venda por falta de follow-up?' },
    { label: 'DESENVOLVIMENTO', text: '80% dos clientes compram após o 5º contato...' },
    { label: 'CTA', text: 'Agende uma demonstração gratuita hoje.' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % sections.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [sections.length]);

  return (
    <div className="flex h-full flex-col justify-center bg-background/55 p-4">
      <div className="text-text-muted mb-3 font-mono text-sm">ROTEIRO_VIDEO_V1.md</div>
      <div className="space-y-3">
        {sections.map((section, i) => (
          <motion.div
            key={section.label}
            animate={{
              opacity: activeIndex === i ? 1 : 0.4,
              scale: activeIndex === i ? 1.02 : 1,
            }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="bg-surface-raised/70 rounded-lg border border-black/[0.12] p-3"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-text-muted font-mono text-xs uppercase">{section.label}</span>
              {activeIndex === i && (
                <motion.div
                  layoutId="active-indicator"
                  className="h-1.5 w-1.5 rounded-full bg-text-primary"
                />
              )}
            </div>
            <div className="text-base text-text-primary">{section.text}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});

// Planejamento Simulation - Breathing status indicators
export const PlanejamentoSimulation = memo(function PlanejamentoSimulation() {
  const [notifVisible, setNotifVisible] = useState(false);

  useEffect(() => {
    const show = setTimeout(() => setNotifVisible(true), 1500);
    const hide = setTimeout(() => setNotifVisible(false), 5000);
    const loop = setInterval(() => {
      setNotifVisible(true);
      setTimeout(() => setNotifVisible(false), 3500);
    }, 7000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      clearInterval(loop);
    };
  }, []);

  return (
    <div className="flex h-full flex-col justify-center bg-background/55 p-4">
      <div className="text-text-muted mb-3 font-mono text-sm">PLANO_CAMPANHA_Q3.json</div>
      <div className="space-y-3">
        <div className="bg-surface-raised/70 flex items-center justify-between rounded-lg border border-black/[0.12] p-3">
          <span className="text-base text-text-primary">Segmentação de público</span>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="h-2 w-2 rounded-full bg-emerald-400"
          />
        </div>
        <div className="bg-surface-raised/70 flex items-center justify-between rounded-lg border border-black/[0.12] p-3">
          <span className="text-base text-text-primary">Cronograma de lançamento</span>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2.5, delay: 0.3 }}
            className="h-2 w-2 rounded-full bg-emerald-400"
          />
        </div>
        <div className="bg-surface-raised/70 flex items-center justify-between rounded-lg border border-black/[0.12] p-3">
          <span className="text-base text-text-primary">Orçamento estimado</span>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2.2, delay: 0.6 }}
            className="h-2 w-2 rounded-full bg-amber-400"
          />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={
            notifVisible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: 0.9 }
          }
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          className="rounded-lg bg-text-primary p-3 shadow-[0_14px_30px_-18px_rgba(27,26,23,0.45)]"
        >
          <div className="text-sm font-medium text-background">Plano pronto para revisão</div>
          <div className="text-xs text-background/60">3 etapas verificadas automaticamente</div>
        </motion.div>
      </div>
    </div>
  );
});

// Pauta Simulation - Infinite carousel
export const PautaSimulation = memo(function PautaSimulation() {
  const pautas = [
    'Como reduzir o CAC em 30%',
    '5 erros no briefing que travam criativos',
    'Case: agência que dobrou a produtividade',
    'Roteiro de vídeo em 15 minutos: é possível?',
    'O que mudar no seu processo operacional',
  ];

  const doubledPautas = [...pautas, ...pautas];

  return (
    <div className="flex h-full flex-col justify-center overflow-hidden bg-background/55 p-4">
      <div className="text-text-muted mb-3 font-mono text-sm">PAUTAS_MAIO_2025.md</div>
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{ repeat: Infinity, ease: 'linear', duration: 20 }}
        className="flex gap-3"
      >
        {doubledPautas.map((pauta, i) => (
          <div
            key={i}
            className="bg-surface-raised/70 w-40 flex-shrink-0 rounded-lg border border-black/[0.12] p-3"
          >
            <div className="text-text-muted mb-2 font-mono text-xs uppercase">
              DIA {String((i % 5) + 1).padStart(2, '0')}
            </div>
            <div className="text-sm leading-snug text-text-primary">{pauta}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
});

// Dados Simulation - Float metrics with counter
export const DadosSimulation = memo(function DadosSimulation() {
  const [count1, setCount1] = useState(0);
  const [count2, setCount2] = useState(0);

  useEffect(() => {
    const controls1 = animate(0, 2847, {
      duration: 2,
      onUpdate: (v) => setCount1(Math.round(v)),
    });
    const controls2 = animate(0, 12.4, {
      duration: 2.5,
      onUpdate: (v) => setCount2(Number(v.toFixed(1))),
    });
    return () => {
      controls1.stop();
      controls2.stop();
    };
  }, []);

  return (
    <div className="flex h-full flex-col justify-center bg-background/55 p-4">
      <div className="text-text-muted mb-3 font-mono text-sm">DASHBOARD_PERFORMANCE.json</div>
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="bg-surface-raised/70 rounded-lg border border-black/[0.12] p-3"
        >
          <div className="text-text-muted font-mono text-xs uppercase">Leads (mês)</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
            {count1.toLocaleString()}
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: 'spring' }}
          className="bg-surface-raised/70 rounded-lg border border-black/[0.12] p-3"
        >
          <div className="text-text-muted font-mono text-xs uppercase">Taxa conversão</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
            {count2}%
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, type: 'spring' }}
          className="bg-surface-raised/70 rounded-lg border border-black/[0.12] p-3"
        >
          <div className="text-text-muted font-mono text-xs uppercase">CAC</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-text-primary">R$ 127,40</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, type: 'spring' }}
          className="bg-surface-raised/70 rounded-lg border border-black/[0.12] p-3"
        >
          <div className="text-text-muted font-mono text-xs uppercase">ROI</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-400">3.2x</div>
        </motion.div>
      </div>
    </div>
  );
});
