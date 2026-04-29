'use client';

import { ScrollReveal } from "@/components/ui/ScrollReveal";

export function Solution() {
  return (
    <section className="bg-background py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold tracking-tighter text-text-primary md:text-4xl leading-tight">
            Um agente para cada tarefa operacional.
            <br />
            Treinado no processo da sua agência.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <p className="mt-8 text-lg leading-relaxed text-text-secondary">
            O Orqest não e uma plataforma para você configurar. E um servico de mapeamento + tecnologia.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <p className="mt-6 text-base leading-relaxed text-text-secondary">
            Nos entramos na sua operação, entendemos como sua equipe trabalha hoje e criamos agentes de IA especializados em cada tarefa repetitiva do dia a dia.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.3}>
          <p className="mt-6 text-base leading-relaxed text-text-secondary">
            Cada agente sabe o formato da sua agência, o tom dos seus clientes e a lógica do seu processo. Eles não entregam textos genéricos. Entregam entregas no padrão que você definiu - so que instantâneas.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.4}>
          <p className="mt-6 text-base leading-relaxed text-text-secondary">
            A equipe não e obrigada a usar nada.{" "}
            <span className="font-medium text-text-primary">
              Eles usam quando precisam
            </span>
            , como chamariam um estagiário experiente. Só que sem erro, sem demora e sem precisar explicar como funciona.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
