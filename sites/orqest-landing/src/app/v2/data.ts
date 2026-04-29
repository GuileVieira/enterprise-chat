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
    description: 'Organiza objetivo, público, tom, referências e entregáveis.',
  },
  {
    name: 'Roteiro',
    description: 'Cria estrutura com gancho, desenvolvimento, CTA e duração.',
  },
  {
    name: 'Pauta',
    description: 'Gera ângulos, formatos e ideias para o calendário editorial.',
  },
  {
    name: 'Planejamento',
    description: 'Monta canais, cronograma, orçamento e métricas.',
  },
  {
    name: 'Dados',
    description: 'Responde perguntas de performance sem abrir uma fila de relatório.',
  },
];

export const processSteps: ProcessStep[] = [
  {
    number: '01',
    title: 'Mapeamos',
    description: 'Entendemos como a equipe trabalha hoje.',
  },
  {
    number: '02',
    title: 'Padronizamos',
    description: 'Transformamos tarefas repetidas em formatos claros.',
  },
  {
    number: '03',
    title: 'Instalamos',
    description: 'Criamos agentes para a equipe usar no dia a dia.',
  },
];

export const operatingSignals = [
  'briefings variam conforme a pessoa',
  'roteiros começam do zero',
  'pautas consomem pesquisa repetida',
  'relatórios dependem de alguém parar tudo',
  'processos existem, mas não são seguidos sempre',
];
