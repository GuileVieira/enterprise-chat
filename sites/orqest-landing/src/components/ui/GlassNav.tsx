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
          ? "border-b border-white/5 bg-background/80 backdrop-blur-xl"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fafaf9"/>
                <stop offset="100%" stop-color="#818cf8"/>
              </linearGradient>
            </defs>
            <path d="M10 50C10 27.9 27.9 10 50 10C65 10 80 20 85 30C70 15 45 15 30 30C15 45 15 65 30 80C18 75 10 65 10 50Z" fill="#fafaf9"/>
            <path d="M90 50C90 72.1 72.1 90 50 90C35 90 20 80 15 70C30 85 55 85 70 70C85 55 85 35 70 20C82 25 90 35 90 50Z" fill="url(#grad)"/>
            <path d="M25 50C25 40 35 25 50 25" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.15"/>
            <path d="M75 50C75 60 65 75 50 75" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.15"/>
            <path d="M15 50C15 35 25 20 45 15" stroke="#fafaf9" strokeWidth="0.5" strokeLinecap="round" strokeOpacity="0.3"/>
            <path d="M85 50C85 65 75 80 55 85" stroke="#818cf8" strokeWidth="0.5" strokeLinecap="round" strokeOpacity="0.4"/>
          </svg>
          <span className="text-lg font-bold tracking-tight text-text-primary">Orqest</span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#como-funciona" className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full px-3 py-1">
            Como funciona
          </a>
          <a href="#agentes" className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full px-3 py-1">
            Agentes
          </a>
          <a href="#faq" className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full px-3 py-1">
            FAQ
          </a>
        </nav>
        <button
          onClick={onCtaClick}
          className="rounded-full bg-text-primary px-6 py-2.5 text-sm font-bold text-background transition-all hover:bg-accent-hover active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Agendar diagnóstico
        </button>
      </div>
    </motion.header>
  );
}
