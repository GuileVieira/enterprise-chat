'use client';

import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { AgentCard } from '@/components/ui/AgentCard';
import {
  BriefingSimulation,
  RoteiroSimulation,
  PlanejamentoSimulation,
  PautaSimulation,
  DadosSimulation,
} from '@/components/ui/AgentSimulation';

export function AgentsBento() {
  return (
    <section id="agentes" className="bg-background py-32">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold leading-tight tracking-tighter text-text-primary md:text-4xl">
            Cada tarefa operacional vira uma entrega instantânea.
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid grid-cols-1 items-start gap-6 md:grid-cols-12">
          <AgentCard
            index={0}
            title="Agente de Briefing"
            description="A account entra as informações do cliente. Em minutos, recebe um briefing completo: objetivo, público-alvo, tom de voz, referências, entregáveis e cronograma. No formato que sua agência sempre usou."
            who="Account / Atendimento"
            simulation={<BriefingSimulation />}
            className="md:col-span-7"
          />
          <AgentCard
            index={1}
            title="Agente de Roteiro"
            description="O produtor entrega o tema e o objetivo do vídeo. O agente retorna com roteiro estruturado: gancho, desenvolvimento, CTA, sugestões de imagem e duração estimada. No tom do cliente."
            who="Redator / Produtor de conteúdo"
            simulation={<RoteiroSimulation />}
            className="md:col-span-5 md:mt-14"
          />
          <AgentCard
            index={2}
            title="Agente de Planejamento"
            description="O diretor informa o objetivo da campanha e o budget. O agente entrega um plano com público-alvo, canais, formatos de conteúdo, cronograma e métricas de sucesso."
            who="Planejador / Diretor de operações"
            simulation={<PlanejamentoSimulation />}
            className="md:col-span-4"
          />
          <AgentCard
            index={3}
            title="Agente de Pauta"
            description="O social media informa o calendário editorial e os temas do mês. O agente retorna com pautas completas: ângulo, formato, referências visuais e copy sugerido."
            who="Social Media / Redator"
            simulation={<PautaSimulation />}
            className="md:col-span-4 md:-mt-10"
          />
          <AgentCard
            index={4}
            title="Agente de Dados"
            description="Qualquer pessoa da equipe faz uma pergunta sobre performance. O agente consulta os dados, extrai o insight e responde em linguagem clara."
            who="Qualquer um da operação"
            simulation={<DadosSimulation />}
            className="md:col-span-4"
          />
        </div>
      </div>
    </section>
  );
}
