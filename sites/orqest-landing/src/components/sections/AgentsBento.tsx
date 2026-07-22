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

        <div className="mt-14 divide-y divide-black/10 border-y border-black/10">
          <AgentCard
            index={0}
            title="Agente de Briefing"
            description="Recebe dados do cliente e devolve briefing estruturado: objetivo, público, tom, referências, entregáveis e cronograma."
            who="Account / Atendimento"
            simulation={<BriefingSimulation />}
          />
          <AgentCard
            index={1}
            title="Agente de Roteiro"
            description="Transforma tema e objetivo em roteiro com gancho, desenvolvimento, CTA, imagens sugeridas e duração."
            who="Redator / Produtor de conteúdo"
            simulation={<RoteiroSimulation />}
          />
          <AgentCard
            index={2}
            title="Agente de Planejamento"
            description="Cria o esqueleto de campanha com público, canais, formatos, cronograma e métricas."
            who="Planejador / Diretor de operações"
            simulation={<PlanejamentoSimulation />}
          />
          <AgentCard
            index={3}
            title="Agente de Pauta"
            description="Gera pautas com ângulo, formato, referência visual e copy inicial."
            who="Social Media / Redator"
            simulation={<PautaSimulation />}
          />
          <AgentCard
            index={4}
            title="Agente de Dados"
            description="Responde perguntas de performance em linguagem direta, sem fila de relatório."
            who="Qualquer um da operação"
            simulation={<DadosSimulation />}
          />
        </div>
      </div>
    </section>
  );
}
