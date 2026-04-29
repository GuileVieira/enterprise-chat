import type { ReactNode } from 'react';
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
  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center justify-center rounded-xl px-6 py-4 text-sm font-semibold transition-all active:translate-y-0',
        variant === 'primary'
          ? 'bg-[#1b1a17] text-[#f4f2ee] hover:-translate-y-0.5'
          : 'border border-[#1b1a17]/15 text-[#1b1a17] hover:bg-[#1b1a17]/5',
      )}
    >
      {children}
    </a>
  );
}

export function SectionIntro({ eyebrow, title, className }: SectionIntroProps) {
  return (
    <div className={className}>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#6f675b]">{eyebrow}</p>
      <h2 className="mt-4 max-w-[13ch] text-4xl font-semibold leading-none tracking-tighter md:text-5xl">
        {title}
      </h2>
    </div>
  );
}

export function Header({ navItems }: HeaderProps) {
  return (
    <header className="border-b border-[#1b1a17]/10">
      <Container className="flex items-center justify-between py-5">
        <a href="/" className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1b1a17] text-sm font-semibold text-[#f4f2ee]">
            O
          </span>
          <OrqestLogo className="h-5 w-[78px] text-[#1b1a17]" />
        </a>
        <nav className="hidden items-center gap-8 text-sm font-medium text-[#5f5b52] md:flex">
          {navItems.map((item) => (
            <a key={item.href} className="transition-colors hover:text-[#1b1a17]" href={item.href}>
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
          <p className="mb-6 max-w-max border-l border-[#7b7164] pl-3 font-mono text-xs uppercase tracking-[0.2em] text-[#6f675b]">
            Operação para agências
          </p>
          <h1 className="max-w-[13ch] text-5xl font-semibold leading-[0.96] tracking-tighter md:text-7xl">
            IA para o trabalho repetido.
          </h1>
          <p className="mt-8 max-w-[56ch] text-xl leading-relaxed text-[#5f5b52]">
            A Orqest transforma rotinas da agência em agentes internos: briefing, roteiro, pauta,
            planejamento e dados.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={diagnosisUrl}>Agendar diagnóstico</ButtonLink>
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
    <aside className="border-[#1b1a17]/12 rounded-[2rem] border bg-[#e8e4dc] p-5 shadow-[0_30px_80px_-55px_rgba(27,26,23,0.65)] md:p-6">
      <div className="rounded-[1.4rem] bg-[#1b1a17] p-5 text-[#f4f2ee]">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/50">
            Mapa operacional
          </p>
          <span className="rounded-md bg-[#7b7164] px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1b1a17]">
            V2
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {checks.map((check) => (
            <div
              key={check}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3"
            >
              <span className="text-white/78 text-sm">{check}</span>
              <span className="h-2 w-2 rounded-full bg-[#7b7164]" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function AgentsSection({ agents }: AgentListProps) {
  return (
    <section id="agentes" className="border-y border-[#1b1a17]/10 bg-[#e8e4dc]">
      <Container className="grid grid-cols-1 gap-10 py-16 md:grid-cols-[0.7fr_1.3fr]">
        <SectionIntro eyebrow="Agentes" title="Um para cada rotina." />
        <div className="divide-y divide-[#1b1a17]/10 border-y border-[#1b1a17]/10">
          {agents.map((agent) => (
            <article
              key={agent.name}
              className="grid grid-cols-1 gap-3 py-6 md:grid-cols-[180px_1fr]"
            >
              <h3 className="text-2xl font-semibold tracking-tight">{agent.name}</h3>
              <p className="max-w-[62ch] text-lg leading-relaxed text-[#5f5b52]">
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
                className="grid grid-cols-[56px_1fr] gap-5 rounded-2xl border border-[#1b1a17]/10 bg-[#e8e4dc] p-5"
              >
                <span className="font-mono text-sm text-[#6f675b]">{step.number}</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-[#5f5b52]">
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
    <section className="border-t border-[#1b1a17]/10">
      <Container className="flex flex-col items-start justify-between gap-8 py-16 md:flex-row md:items-end">
        <SectionIntro
          eyebrow="Diagnóstico gratuito"
          title="Veja quais tarefas podem virar agente."
          className="max-w-xl"
        />
        <ButtonLink href={diagnosisUrl}>Agendar diagnóstico</ButtonLink>
      </Container>
    </section>
  );
}
