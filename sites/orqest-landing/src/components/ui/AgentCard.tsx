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
        "group relative overflow-hidden rounded-[2rem] border border-slate-200/50 bg-white p-8 shadow-diffusion transition-shadow hover:shadow-diffusion-lg",
        className
      )}
    >
      <div className="mb-6 h-48 overflow-hidden rounded-xl bg-slate-50">
        {simulation}
      </div>
      <h3 className="mb-2 text-lg font-semibold tracking-tight text-text-primary">{title}</h3>
      <p className="mb-4 text-sm leading-relaxed text-text-secondary">{description}</p>
      <p className="text-xs font-mono text-text-muted">{who}</p>
    </motion.div>
  );
}
