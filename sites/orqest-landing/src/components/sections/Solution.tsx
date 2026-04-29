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
            Treinado no processo da sua agencia.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <p className="mt-8 text-lg leading-relaxed text-text-secondary">
            O Orqest nao e uma plataforma para voce configurar. E um servico de mapeamento + tecnologia.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <p className="mt-6 text-base leading-relaxed text-text-secondary">
            Nos entramos na sua operacao, entendemos como sua equipe trabalha hoje e criamos agentes de IA especializados em cada tarefa repetitiva do dia a dia.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.3}>
          <p className="mt-6 text-base leading-relaxed text-text-secondary">
            Cada agente sabe o formato da sua agencia, o tom dos seus clientes e a logica do seu processo. Eles nao entregam textos genericos. Entregam entregas no padrao que voce definiu — so que instantaneas.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.4}>
          <p className="mt-6 text-base leading-relaxed text-text-secondary">
            A equipe nao e obrigada a usar nada.{" "}
            <span className="font-medium text-text-primary">
              Eles usam quando precisam
            </span>
            , como chamariam um estagiario experiente. So que sem erro, sem demora e sem precisar explicar como funciona.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
