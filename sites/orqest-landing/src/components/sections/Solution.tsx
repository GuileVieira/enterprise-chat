'use client';

import { ScrollReveal } from '@/components/ui/ScrollReveal';

const flowSteps = [
  {
    number: '01',
    label: 'Entrada',
    title: 'Briefing bruto',
    detail: 'dados do cliente',
  },
  {
    number: '02',
    label: 'Padrão',
    title: 'Regras da agência',
    detail: 'formato aprovado',
  },
  {
    number: '03',
    label: 'Agente',
    title: 'Entrega pronta',
    detail: 'revisão final',
  },
];

export function Solution() {
  return (
    <section className="bg-background py-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-14 px-6 md:grid-cols-[0.9fr_1.1fr]">
        <div className="md:pt-10">
          <ScrollReveal>
            <p className="text-moss mb-5 font-mono text-xs uppercase tracking-[0.22em]">
              Modelo de implantação
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tighter text-text-primary md:text-5xl">
              Um agente para cada tarefa operacional. Treinado no processo da sua agência.
            </h2>
          </ScrollReveal>
        </div>

        <div className="md:border-l md:border-black/10 md:pl-10">
          <ScrollReveal delay={0.1}>
            <p className="text-lg leading-relaxed text-text-secondary">
              A Orqest não é uma plataforma para você configurar. É um serviço de mapeamento +
              operação instalada.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="mt-8 text-base leading-relaxed text-text-secondary">
              Nós entramos na sua operação, entendemos como sua equipe trabalha hoje e traduzimos
              cada tarefa repetitiva em uma entrega automática no seu padrão.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <p className="mt-8 text-base leading-relaxed text-text-secondary">
              Cada agente sabe o formato da sua agência, o tom dos seus clientes e a lógica do seu
              processo. Não entrega textos genéricos. Entrega no padrão que você definiu, só que
              instantâneo.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.4}>
            <p className="mt-8 text-base leading-relaxed text-text-secondary">
              A equipe não é obrigada a usar nada.{' '}
              <span className="font-medium text-text-primary">Usa quando precisa</span>, como
              chamaria um estagiário experiente. Só que sem erro, sem demora e sem precisar explicar
              como funciona.
            </p>
          </ScrollReveal>
        </div>
      </div>

      <div className="mx-auto mt-20 max-w-7xl px-6">
        <ScrollReveal delay={0.2}>
          <div
            aria-label="Mapa visual mostrando como uma tarefa operacional vira um agente da Orqest"
            className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-background p-5 shadow-[0_28px_70px_-48px_rgba(67,61,52,0.42)] md:p-8"
          >
            <div className="absolute right-8 top-6 hidden opacity-15 md:block">
              <svg width="180" height="180" viewBox="0 0 180 180" fill="none">
                {[78, 58, 38, 18].map((radius) => (
                  <circle
                    key={radius}
                    cx="90"
                    cy="90"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-text-primary"
                  />
                ))}
              </svg>
            </div>

            <p className="text-moss font-mono text-xs uppercase tracking-[0.22em]">
              Como uma tarefa vira agente
            </p>
            <div className="relative mt-8 grid grid-cols-1 gap-4 md:grid-cols-3 md:items-stretch">
              {flowSteps.map((step, index) => (
                <div key={step.number} className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
                  <article
                    className={
                      index === 2
                        ? 'rounded-[1.5rem] bg-text-primary p-6 text-background'
                        : 'bg-surface rounded-[1.5rem] border border-black/10 p-6 text-text-primary'
                    }
                  >
                    <p
                      className={
                        index === 2
                          ? 'font-mono text-xs uppercase tracking-[0.2em] text-background/60'
                          : 'text-moss font-mono text-xs uppercase tracking-[0.2em]'
                      }
                    >
                      {step.number} / {step.label}
                    </p>
                    <h3
                      className={
                        index === 2
                          ? 'mt-4 text-2xl font-semibold tracking-tight text-background'
                          : 'mt-4 text-2xl font-semibold tracking-tight text-text-primary'
                      }
                    >
                      {step.title}
                    </h3>
                    <p
                      className={
                        index === 2
                          ? 'mt-4 text-sm text-background/65'
                          : 'text-text-muted mt-4 text-sm'
                      }
                    >
                      {step.detail}
                    </p>
                  </article>
                  {index < flowSteps.length - 1 && (
                    <div className="hidden items-center md:flex">
                      <div className="bg-text-muted h-px w-10" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
