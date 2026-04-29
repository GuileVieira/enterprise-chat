'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { OrqestIcon } from '@/components/icons/OrqestIcon';
import { OrqestLogo } from '@/components/icons/OrqestLogo';

interface GlassNavProps {
  onCtaClick?: () => void;
}

export function GlassNav({ onCtaClick }: GlassNavProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className={cn(
        'fixed left-0 right-0 top-0 z-50 transition-all duration-300',
        scrolled ? 'border-b border-white/5 bg-background/80 backdrop-blur-xl' : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2">
          <OrqestIcon className="h-8 w-8" />
          <OrqestLogo className="h-5 w-[76px] text-text-primary" />
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#como-funciona"
            className="rounded-full px-3 py-1 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Como funciona
          </a>
          <a
            href="#agentes"
            className="rounded-full px-3 py-1 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Agentes
          </a>
          <a
            href="#faq"
            className="rounded-full px-3 py-1 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            FAQ
          </a>
        </nav>
        <button
          onClick={onCtaClick}
          className="hover:bg-accent-hover rounded-full bg-text-primary px-6 py-2.5 text-sm font-bold text-background transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
        >
          Agendar diagnóstico
        </button>
      </div>
    </motion.header>
  );
}
