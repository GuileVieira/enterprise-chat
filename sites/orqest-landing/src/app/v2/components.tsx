import type { ReactNode } from 'react';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { OrqestIcon } from '@/components/icons/OrqestIcon';
import { OrqestLogo } from '@/components/icons/OrqestLogo';
import { cn } from '@/lib/utils';
import type { AgentItem, NavItem, ProcessStep } from './data';

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

interface SectionIntroProps {
  eyebrow: string;
  title: string;
  className?: string;
}

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}

interface HeaderProps {
  navItems: NavItem[];
}

interface HeroProps {
  checks: string[];
  diagnosisUrl: string;
}

interface AgentListProps {
  agents: AgentItem[];
}

interface ProcessStepsProps {
  steps: ProcessStep[];
}

interface CtaSectionProps {
  diagnosisUrl: string;
}

export function Container({ children, className }: ContainerProps) {
  return <div className={cn('mx-auto max-w-7xl px-5 md:px-8', className)}>{children}</div>;
}

export function ButtonLink({ href, children, variant = 'primary' }: ButtonLinkProps) {
  if (variant === 'primary') {
    return (
      <MagneticButton href={href} className="shadow-diffusion px-7 py-4">
        {children}
      </MagneticButton>
    );
  }

  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-full border border-black/15 px-6 py-4 text-sm font-semibold text-text-primary transition-colors hover:bg-black/[0.04] active:scale-[0.98]"
    >
      {children}
    </a>
  );
}

export function SectionIntro({ eyebrow, title, className }: SectionIntroProps) {
  return (
    <div className={className}>
      <p className="text-moss font-mono text-xs uppercase tracking-[0.2em]">{eyebrow}</p>
      <h2 className="mt-4 max-w-[13ch] text-4xl font-semibold leading-none tracking-tighter md:text-5xl">
        {title}
      </h2>
    </div>
  );
}

export function Header({ navItems }: HeaderProps) {
  return (
    <header className="border-b border-black/10">
      <Container className="flex items-center justify-between py-5">
        <a href="/" className="flex items-center gap-3">
          <OrqestIcon className="h-8 w-8" />
          <OrqestLogo className="h-5 w-[78px] text-text-primary" />
        </a>
        <nav className="hidden items-center gap-8 text-sm font-medium text-text-secondary md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              className="transition-colors hover:text-text-primary"
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </Container>
    </header>
  );
}

export function Hero({ checks, diagnosisUrl }: HeroProps) {
  return (
    <section>
      <Container className="grid grid-cols-1 gap-12 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
        <div>
          <p className="border-moss text-moss mb-6 max-w-max border-l pl-3 font-mono text-xs uppercase tracking-[0.2em]">
            Operação para agências
          </p>
          <h1 className="max-w-[13ch] text-5xl font-semibold leading-[0.96] tracking-tighter text-text-primary md:text-7xl">
            Sua agência operando com agentes treinados no seu processo.
          </h1>
          <p className="mt-8 max-w-[56ch] text-xl leading-relaxed text-text-secondary">
            A Orqest mapeia briefing, roteiro, pauta, planejamento e dados, transforma em fluxos
            reutilizáveis e instala agentes que seguem o jeito da sua equipe trabalhar.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={diagnosisUrl}>Mapear meus processos</ButtonLink>
            <ButtonLink href="#agentes" variant="secondary">
              Ver agentes
            </ButtonLink>
          </div>
        </div>

        <DiagnosticPanel checks={checks} />
      </Container>
    </section>
  );
}

function DiagnosticPanel({ checks }: { checks: string[] }) {
  return (
    <aside className="bg-surface shadow-diffusion-lg rounded-[2rem] border border-black/10 p-5 md:p-6">
      <div className="rounded-[1.4rem] bg-text-primary p-5 text-background">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/50">
            Mapa operacional
          </p>
          <span className="bg-moss rounded-md px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-background">
            auditoria
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {checks.map((check) => (
            <div
              key={check}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3"
            >
              <span className="text-white/78 text-sm">{check}</span>
              <span className="bg-moss h-2 w-2 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function AgentsSection({ agents }: AgentListProps) {
  return (
    <section id="agentes" className="bg-surface border-y border-black/10">
      <Container className="grid grid-cols-1 gap-10 py-16 md:grid-cols-[0.7fr_1.3fr]">
        <SectionIntro eyebrow="Agentes" title="Um para cada rotina." />
        <div className="divide-y divide-black/10 border-y border-black/10">
          {agents.map((agent) => (
            <article
              key={agent.name}
              className="grid grid-cols-1 gap-3 py-6 md:grid-cols-[180px_1fr]"
            >
              <h3 className="text-2xl font-semibold tracking-tight">{agent.name}</h3>
              <p className="max-w-[62ch] text-lg leading-relaxed text-text-secondary">
                {agent.description}
              </p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function ProcessSection({ steps }: ProcessStepsProps) {
  return (
    <section id="processo">
      <Container className="py-16 md:py-24">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[0.85fr_1.15fr]">
          <h2 className="max-w-[13ch] text-4xl font-semibold leading-none tracking-tighter md:text-5xl">
            Sem promessa grande. Só implementação.
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {steps.map((step) => (
              <article
                key={step.number}
                className="bg-surface grid grid-cols-[56px_1fr] gap-5 rounded-2xl border border-black/10 p-5"
              >
                <span className="text-moss font-mono text-sm">{step.number}</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-text-secondary">
                    {step.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

export function CtaSection({ diagnosisUrl }: CtaSectionProps) {
  return (
    <section className="border-t border-black/10">
      <Container className="flex flex-col items-start justify-between gap-8 py-16 md:flex-row md:items-end">
        <SectionIntro
          eyebrow="Diagnóstico gratuito"
          title="Saia com o mapa dos processos que podem virar agente."
          className="max-w-xl"
        />
        <ButtonLink href={diagnosisUrl}>Mapear meus processos</ButtonLink>
      </Container>
    </section>
  );
}
