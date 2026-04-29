'use client';

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface GlassNavProps {
  onCtaClick?: () => void;
}

export function GlassNav({ onCtaClick }: GlassNavProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-white/10 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2">
          <span className="text-xl font-semibold tracking-tight text-text-primary">Orqest</span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#como-funciona" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
            Como funciona
          </a>
          <a href="#agentes" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
            Agentes
          </a>
          <a href="#faq" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
            FAQ
          </a>
        </nav>
        <button
          onClick={onCtaClick}
          className="rounded-full bg-text-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover active:scale-[0.98]"
        >
          Agendar diagnostico
        </button>
      </div>
    </motion.header>
  );
}
