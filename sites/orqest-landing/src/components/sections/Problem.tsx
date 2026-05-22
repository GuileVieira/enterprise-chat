'use client';

import { ScrollReveal } from '@/components/ui/ScrollReveal';

export function Problem() {
  const pains = [
    {
      role: 'Account',
      text: 'passa 40 minutos montando um briefing que o redator não consegue entender.',
    },
    {
      role: 'Planejador',
      text: 'gasta uma manhã inteira estruturando um plano de campanha que poderia ter um esqueleto pronto em minutos.',
    },
    {
      role: 'Social media',
      text: 'perde duas horas pesquisando angulos de pauta que um agente treinado no tom da agência entregaria de primeira.',
    },
    {
      role: 'Redator',
      text: 'escreve o roteiro do vídeo do zero - pela centésima vez - porque não existe um padrão que acelere o trabalho.',
    },
    {
      role: 'Operação',
      text: 'para tudo para criar um relatório que o cliente pediu com urgência.',
    },
  ];

  return (
    <section className="bg-background py-32">
      <div className="mx-auto max-w-3xl px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold leading-tight tracking-tighter text-text-primary md:text-4xl">
            O briefing que deveria levar 20 minutos leva duas horas.
            <br />O roteiro que deveria sair em um dia demora uma semana.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <p className="mt-8 text-lg leading-relaxed text-text-secondary">
            Sua agência tem bons profissionais. O problema não é falta de talento. É que o talento
            está preso em tarefas operacionais.
          </p>
        </ScrollReveal>

        <div className="mt-12 space-y-0">
          {pains.map((pain, i) => (
            <ScrollReveal key={pain.role} delay={0.1 * (i + 2)}>
              <div className="border-t border-black/10 py-6">
                <p className="text-base leading-relaxed text-text-secondary">
                  <span className="font-medium text-text-primary">{pain.role}</span> {pain.text}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.8}>
          <p className="mt-8 text-base leading-relaxed text-text-secondary">
            E no final do dia, a equipe está exausta. E a parte criativa - a que realmente
            diferencia sua agência - ficou para depois. Sempre para depois.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.9}>
          <div className="bg-surface mt-8 rounded-2xl border border-black/10 p-6">
            <p className="text-sm leading-relaxed text-text-secondary">
              Dados do setor mostram que equipes de marketing gastam{' '}
              <span className="font-semibold text-text-primary">
                até 60% do tempo em tarefas operacionais
              </span>
              : relatórios, organização de dados, formatação, configuração de campanhas,
              comunicações repetitivas. O que sobra para criatividade e estratégia é menos da metade
              da jornada.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
