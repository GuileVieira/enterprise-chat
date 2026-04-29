'use client';

import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { AgentCard } from "@/components/ui/AgentCard";
import {
  BriefingSimulation,
  RoteiroSimulation,
  PlanejamentoSimulation,
  PautaSimulation,
  DadosSimulation,
} from "@/components/ui/AgentSimulation";

export function AgentsBento() {
  return (
    <section id="agentes" className="bg-slate-50 py-32">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold tracking-tighter text-text-primary md:text-4xl leading-tight">
            Seu time de agentes, pronto para trabalhar.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-[2fr_2fr]">
          <AgentCard
            index={0}
            title="Agente de Briefing"
            description="A account entra as informacoes do cliente. Em minutos, recebe um briefing completo: objetivo, publico-alvo, tom de voz, referencias, entregaveis e cronograma. No formato que sua agencia sempre usou."
            who="Account / Atendimento"
            simulation={<BriefingSimulation />}
          />
          <AgentCard
            index={1}
            title="Agente de Roteiro"
            description="O produtor entrega o tema e o objetivo do video. O agente retorna com roteiro estruturado: gancho, desenvolvimento, CTA, sugestoes de imagem e duracao estimada. No tom do cliente."
            who="Redator / Produtor de conteudo"
            simulation={<RoteiroSimulation />}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <AgentCard
            index={2}
            title="Agente de Planejamento"
            description="O diretor informa o objetivo da campanha e o budget. O agente entrega um plano com publico-alvo, canais, formatos de conteudo, cronograma e metricas de sucesso."
            who="Planejador / Diretor de operacoes"
            simulation={<PlanejamentoSimulation />}
          />
          <AgentCard
            index={3}
            title="Agente de Pauta"
            description="O social media informa o calendario editorial e os temas do mes. O agente retorna com pautas completas: angulo, formato, referencias visuais e copy sugerido."
            who="Social Media / Redator"
            simulation={<PautaSimulation />}
          />
          <AgentCard
            index={4}
            title="Agente de Dados"
            description="Qualquer pessoa da equipe faz uma pergunta sobre performance. O agente consulta os dados, extrai o insight e responde em linguagem clara."
            who="Qualquer um da operacao"
            simulation={<DadosSimulation />}
          />
        </div>
      </div>
    </section>
  );
}
