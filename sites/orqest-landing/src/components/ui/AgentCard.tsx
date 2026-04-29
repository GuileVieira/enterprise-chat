'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AgentCardProps {
  title: string;
  description: string;
  who: string;
  simulation: ReactNode;
  className?: string;
  index: number;
}

export function AgentCard({
  title,
  description,
  who,
  simulation,
  className,
  index,
}: AgentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{
        type: 'spring',
        stiffness: 100,
        damping: 20,
        delay: index * 0.1,
      }}
      className={cn(
        'group grid grid-cols-1 gap-6 py-8 transition-colors md:grid-cols-[minmax(280px,0.82fr)_minmax(0,1fr)] md:items-center md:gap-10',
        className,
      )}
    >
      <div className="order-2 md:order-1">
        <h3 className="mb-3 text-2xl font-semibold tracking-tight text-text-primary">{title}</h3>
        <p className="max-w-[58ch] text-base leading-relaxed text-text-secondary">{description}</p>
        <div className="mt-5 flex items-center gap-2">
          <div className="bg-moss h-1.5 w-1.5 flex-shrink-0 rounded-full" />
          <p className="text-text-muted font-mono text-xs uppercase tracking-[0.18em]">{who}</p>
        </div>
      </div>
      <div className="bg-surface-raised order-1 min-h-[180px] overflow-hidden rounded-[1.35rem] border border-black/[0.12] shadow-[0_18px_45px_-34px_rgba(67,61,52,0.42)] transition-transform group-hover:-translate-y-1 md:order-2 md:min-h-[200px]">
        {simulation}
      </div>
    </motion.div>
  );
}
