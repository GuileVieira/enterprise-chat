'use client';

import { ScrollReveal } from '@/components/ui/ScrollReveal';

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

        <div className="md:border-l md:border-white/10 md:pl-10">
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
    </section>
  );
}
