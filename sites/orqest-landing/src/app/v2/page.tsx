import type { Metadata } from 'next';
import { AgentsSection, CtaSection, Header, Hero, ProcessSection } from './components';
import { agents, diagnosisUrl, navItems, operatingSignals, processSteps } from './data';

export const metadata: Metadata = {
  title: 'Orqest - Agentes de IA para operação de agência',
  description:
    'Mapeamos rotinas repetidas da agência e instalamos agentes de IA para briefing, roteiro, pauta, planejamento e dados.',
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
