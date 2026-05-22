import { Metadata } from 'next';
import { MagneticButton } from '@/components/ui/MagneticButton';

export const metadata: Metadata = {
  title: 'Obrigado - Orqest',
  description: 'Obrigado por se interessar no Orqest. Agende sua reunião de diagnóstico gratuito.',
  openGraph: {
    title: 'Obrigado - Orqest',
    description: 'Obrigado por se interessar no Orqest. Agende sua reunião de diagnóstico gratuito.',
    type: 'website',
    locale: 'pt_BR',
    url: 'https://orqest.com/obrigado',
    siteName: 'Orqest',
    images: [
      {
        url: '/logo-full.png',
        width: 1200,
        height: 630,
        alt: 'Obrigado - Orqest',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Obrigado - Orqest',
    description: 'Obrigado por se interessar no Orqest. Agende sua reunião de diagnóstico gratuito.',
    images: ['/logo-full.png'],
  },
};

export default function ObrigadoPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12L10 17L19 8"
              stroke="#4ade80"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-semibold leading-tight tracking-tighter text-text-primary md:text-4xl">
          Obrigado por se interessar na Orqest
        </h1>

        <p className="mt-6 text-lg leading-relaxed text-text-secondary">
          Baseado nas suas respostas, você é um bom fit para a Orqest. Agende agora sua reunião de
          30 minutos para mapearmos sua operação.
        </p>

        <div className="mt-10">
          <MagneticButton href="https://cal.com/orqest/diagnostico">
            Agendar minha reunião de 30 minutos
          </MagneticButton>
        </div>

        <p className="text-text-muted mt-6 text-sm">
          Ou, se preferir, baixe nosso guia de processos operacionais para agências.
        </p>

        <div className="mt-4">
          <a
            href="#"
            className="hover:bg-surface-raised inline-flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-sm font-medium text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Baixar guia gratuito
          </a>
        </div>
      </div>
    </main>
  );
}
