import type { Metadata } from 'next';
import { AgentsSection, CtaSection, Header, Hero, ProcessSection } from './components';
import { agents, diagnosisUrl, navItems, operatingSignals, processSteps } from './data';

export const metadata: Metadata = {
  title: 'Orqest V2 - Agentes de IA para rotinas de agência',
  description:
    'Uma versão mais direta da landing Orqest, focada em leitura rápida e clareza operacional.',
};

export default function LandingV2() {
  return (
    <main className="min-h-[100dvh] bg-[#f4f2ee] text-[#1b1a17]">
      <Header navItems={navItems} />
      <Hero checks={operatingSignals} diagnosisUrl={diagnosisUrl} />
      <AgentsSection agents={agents} />
      <ProcessSection steps={processSteps} />
      <CtaSection diagnosisUrl={diagnosisUrl} />
    </main>
  );
}
