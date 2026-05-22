import type { Metadata } from 'next';
import { AgentsSection, CtaSection, Header, Hero, ProcessSection } from './components';
import { agents, diagnosisUrl, navItems, operatingSignals, processSteps } from './data';

export const metadata: Metadata = {
  title: 'Orqest - Agentes de IA para operação de agência',
  description:
    'Mapeamos processos da agência e instalamos agentes de IA treinados para briefing, roteiro, pauta, planejamento e dados.',
  openGraph: {
    title: 'Orqest - Agentes de IA para operação de agência',
    description:
      'Mapeamos processos da agência e instalamos agentes de IA treinados para briefing, roteiro, pauta, planejamento e dados.',
    type: 'website',
    locale: 'pt_BR',
    url: 'https://orqest.com/v2',
    siteName: 'Orqest',
    images: [
      {
        url: '/logo-full.png',
        width: 1200,
        height: 630,
        alt: 'Orqest - Agentes de IA para operação de agência',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Orqest - Agentes de IA para operação de agência',
    description:
      'Mapeamos processos da agência e instalamos agentes de IA treinados para briefing, roteiro, pauta, planejamento e dados.',
    images: ['/logo-full.png'],
  },
};

export default function LandingV2() {
  return (
    <main className="min-h-[100dvh] bg-background text-text-primary">
      <Header navItems={navItems} />
      <Hero checks={operatingSignals} diagnosisUrl={diagnosisUrl} />
      <AgentsSection agents={agents} />
      <ProcessSection steps={processSteps} />
      <CtaSection diagnosisUrl={diagnosisUrl} />
    </main>
  );
}
