'use client';

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AgentCardProps {
  title: string;
  description: string;
  who: string;
  simulation: ReactNode;
  className?: string;
  index: number;
}

export function AgentCard({ title, description, who, simulation, className, index }: AgentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        type: "spring",
        stiffness: 100,
        damping: 20,
        delay: index * 0.1,
      }}
      className={cn(
        "group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-surface p-8 transition-all hover:border-white/20",
        className
      )}
    >
      <div className="mb-6 h-48 overflow-hidden rounded-3xl bg-white/[0.03]">
        {simulation}
      </div>
      <h3 className="mb-2 text-xl font-bold tracking-tight text-text-primary">{title}</h3>
      <p className="mb-6 text-sm leading-relaxed text-text-secondary">{description}</p>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full bg-accent" />
        <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{who}</p>
      </div>
    </motion.div>
  );
}
