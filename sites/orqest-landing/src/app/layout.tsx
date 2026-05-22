import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Orqest - Agentes de IA para Operação Interna de Agências',
  description:
    'Mapeamos seus processos operacionais e criamos agentes de IA especializados em briefing, roteiro, planejamento e relatórios. Sua equipe usa quando precisa.',
  icons: {
    icon: '/icon-white.svg',
  },
  openGraph: {
    title: 'Orqest - Agentes de IA para Operação Interna de Agências',
    description:
      'Mapeamos seus processos operacionais e criamos agentes de IA especializados em briefing, roteiro, planejamento e relatórios. Sua equipe usa quando precisa.',
    type: 'website',
    locale: 'pt_BR',
    url: 'https://orqest.com',
    siteName: 'Orqest',
    images: [
      {
        url: '/logo-full.png',
        width: 1200,
        height: 630,
        alt: 'Orqest - Agentes de IA para Operação Interna de Agências',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Orqest - Agentes de IA para Operação Interna de Agências',
    description:
      'Mapeamos seus processos operacionais e criamos agentes de IA especializados em briefing, roteiro, planejamento e relatórios. Sua equipe usa quando precisa.',
    images: ['/logo-full.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        {process.env.NEXT_PUBLIC_GA4_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA4_ID}');
              `,
              }}
            />
          </>
        )}
        {process.env.NEXT_PUBLIC_META_PIXEL_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${process.env.NEXT_PUBLIC_META_PIXEL_ID}');
              fbq('track', 'PageView');
            `,
            }}
          />
        )}
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
