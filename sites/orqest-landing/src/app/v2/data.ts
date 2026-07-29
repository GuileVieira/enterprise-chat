export const diagnosisUrl = 'https://cal.com/orqest/diagnostico';

export interface NavItem {
  label: string;
  href: string;
}

export interface AgentItem {
  name: string;
  description: string;
}

export interface ProcessStep {
  number: string;
  title: string;
  description: string;
}

export const navItems: NavItem[] = [
  { label: 'Agentes', href: '#agentes' },
  { label: 'Processo', href: '#processo' },
  { label: 'Diagnóstico', href: diagnosisUrl },
];

export const agents: AgentItem[] = [
  {
    name: 'Briefing',
    description: 'Sai com objetivo, público, tom, referências, entregáveis e próximos passos.',
  },
  {
    name: 'Roteiro',
    description: 'Transforma tema solto em gancho, desenvolvimento, CTA e sugestão de cenas.',
  },
  {
    name: 'Pauta',
    description: 'Abre caminhos de conteúdo sem começar a pesquisa toda vez do zero.',
  },
  {
    name: 'Planejamento',
    description: 'Monta canais, cronograma, orçamento e métrica antes da reunião começar.',
  },
  {
    name: 'Dados',
    description: 'Responde perguntas de performance sem travar alguém em planilha.',
  },
];

export const processSteps: ProcessStep[] = [
  {
    number: '01',
    title: 'Mapeamos',
    description: 'Pegamos exemplos reais de briefing, roteiro, pauta, plano e relatório.',
  },
  {
    number: '02',
    title: 'Padronizamos',
    description: 'Transformamos o jeito da sua agência em regras que o agente consegue seguir.',
  },
  {
    number: '03',
    title: 'Instalamos',
    description: 'A equipe usa quando precisa e revisa a entrega, em vez de começar do zero.',
  },
];

export const operatingSignals = [
  'briefing muda dependendo de quem monta',
  'roteiro começa do zero toda semana',
  'pauta depende de pesquisa repetida',
  'relatório para a operação',
  'processo existe, mas ninguém segue igual',
];
