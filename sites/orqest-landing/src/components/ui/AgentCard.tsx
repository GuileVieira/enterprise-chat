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
        'bg-surface hover:border-moss/35 hover:bg-surface-raised group relative overflow-hidden rounded-[2rem] border border-white/[0.14] p-6 shadow-[0_26px_70px_-45px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:-translate-y-1 md:p-8',
        className,
      )}
    >
      <div className="mb-7 h-64 overflow-hidden rounded-[1.5rem] border border-white/[0.14] bg-background/70">
        {simulation}
      </div>
      <div>
        <h3 className="mb-4 text-2xl font-semibold tracking-tight text-text-primary">{title}</h3>
        <p className="text-base leading-relaxed text-text-secondary">{description}</p>
      </div>
      <div className="mt-7 flex items-center gap-2">
        <div className="bg-moss h-1.5 w-1.5 flex-shrink-0 rounded-full" />
        <p className="text-text-muted font-mono text-xs uppercase tracking-[0.18em]">{who}</p>
      </div>
    </motion.div>
  );
}
