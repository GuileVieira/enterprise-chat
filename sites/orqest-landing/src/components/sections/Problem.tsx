'use client';

import { ScrollReveal } from "@/components/ui/ScrollReveal";

export function Problem() {
  const pains = [
    {
      role: "Account",
      text: "passa 40 minutos montando um briefing que o redator nÃ£o consegue entender.",
    },
    {
      role: "Planejador",
      text: "gasta uma manhÃ£ inteira estruturando um plano de campanha que poderia ter um esqueleto pronto em minutos.",
    },
    {
      role: "Social media",
      text: "perde duas horas pesquisando angulos de pauta que um agente treinado no tom da agÃªncia entregaria de primeira.",
    },
    {
      role: "Redator",
      text: "escreve o roteiro do vÃ­deo do zero — pela centÃ©sima vez — porque nÃ£o existe um padrÃ£o que acelere o trabalho.",
    },
    {
      role: "Operacao",
      text: "para tudo para criar um relatorio que o cliente pediu com urgencia.",
    },
  ];

  return (
    <section className="bg-background py-32">
      <div className="mx-auto max-w-3xl px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-semibold tracking-tighter text-text-primary md:text-4xl leading-tight">
            O briefing que deveria levar 20 minutos leva duas horas.
            <br />
            O roteiro que deveria sair em um dia demora uma semana.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <p className="mt-8 text-lg leading-relaxed text-text-secondary">
            Sua agÃªncia tem bons profissionais. O problema nÃ£o e falta de talento. E que o talento esta preso em tarefas operacionais.
          </p>
        </ScrollReveal>

        <div className="mt-12 space-y-0">
          {pains.map((pain, i) => (
            <ScrollReveal key={pain.role} delay={0.1 * (i + 2)}>
              <div className="border-t border-slate-200/50 py-6">
                <p className="text-base leading-relaxed text-text-secondary">
                  <span className="font-medium text-text-primary">{pain.role}</span>{" "}
                  {pain.text}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.8}>
          <p className="mt-8 text-base leading-relaxed text-text-secondary">
            E no final do dia, a equipe esta exausta. E a parte criativa — a que realmente diferencia sua agÃªncia — ficou para depois. Sempre para depois.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.9}>
          <div className="mt-8 rounded-2xl border border-slate-200/50 bg-white p-6 shadow-diffusion">
            <p className="text-sm leading-relaxed text-text-secondary">
              Dados do setor mostram que equipes de marketing gastam{" "}
              <span className="font-semibold text-text-primary">atÃ© 60% do tempo em tarefas operacionais</span>: relatÃ³rios, organizaÃ§Ã£o de dados, formataÃ§Ã£o, configuraÃ§Ã£o de campanhas, comunicaÃ§Ãµes repetitivas. O que sobra para criatividade e estratÃ©gia e menos da metade da jornada.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
