import { ThemeSelector } from '@librechat/client';
import type { TStartupConfig } from 'librechat-data-provider';
import { ErrorMessage } from '~/components/Auth/ErrorMessage';
import { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import SocialLoginRender from './SocialLoginRender';
import { BlinkAnimation } from './BlinkAnimation';
import { Banner } from '../Banners';
import Footer from './Footer';

function OrqestMark({ title, wordmark }: { title: string; wordmark: string }) {
  return (
    <svg viewBox="0 0 180 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label={title}>
      <g transform="translate(0, 2) scale(0.36)">
        <path
          d="M10 50C10 27.9 27.9 10 50 10C65 10 80 20 85 30C70 15 45 15 30 30C15 45 15 65 30 80C18 75 10 65 10 50Z"
          fill="currentColor"
        />
        <path
          d="M90 50C90 72.1 72.1 90 50 90C35 90 20 80 15 70C30 85 55 85 70 70C85 55 85 35 70 20C82 25 90 35 90 50Z"
          fill="currentColor"
          opacity="0.64"
        />
        <path
          d="M25 50C25 40 35 25 50 25"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.24"
        />
        <path
          d="M75 50C75 60 65 75 50 75"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.24"
        />
      </g>
      <text
        x="44"
        y="28"
        fill="currentColor"
        fontSize="24"
        fontWeight="650"
        letterSpacing="-0.02em"
        fontFamily="Geist, Satoshi, system-ui, -apple-system, sans-serif"
      >
        {wordmark}
      </text>
    </svg>
  );
}

function AuthLayout({
  children,
  header,
  isFetching,
  startupConfig,
  startupConfigError,
  pathname,
  error,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  isFetching: boolean;
  startupConfig: TStartupConfig | null | undefined;
  startupConfigError: unknown | null | undefined;
  pathname: string;
  error: TranslationKeys | null;
}) {
  const localize = useLocalize();

  const hasStartupConfigError = startupConfigError !== null && startupConfigError !== undefined;
  const DisplayError = () => {
    if (hasStartupConfigError) {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>{localize('com_auth_error_login_server')}</ErrorMessage>
        </div>
      );
    } else if (error === 'com_auth_error_invalid_reset_token') {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>
            {localize('com_auth_error_invalid_reset_token')}{' '}
            <a
              className="font-semibold text-surface-submit transition-colors hover:text-surface-submit-hover hover:underline"
              href="/forgot-password"
            >
              {localize('com_auth_click_here')}
            </a>{' '}
            {localize('com_auth_to_try_again')}
          </ErrorMessage>
        </div>
      );
    } else if (error != null && error) {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>{localize(error)}</ErrorMessage>
        </div>
      );
    }
    return null;
  };

  const logoLabel = localize('com_ui_logo', { 0: startupConfig?.appTitle ?? 'Orqest' });
  const appTitle = startupConfig?.appTitle ?? 'Orqest';

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-surface-primary text-text-primary">
      <Banner />
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-surface-submit/10 absolute left-[-10%] top-[-20%] h-[34rem] w-[34rem] rounded-full blur-3xl" />
        <div className="absolute bottom-[-18%] right-[-12%] h-[30rem] w-[30rem] rounded-full bg-surface-tertiary blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_34%)]" />
      </div>

      <div className="relative z-10 grid min-h-dvh w-full lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
        <section className="hidden min-h-dvh flex-col justify-between border-r border-border-light px-10 py-10 lg:flex">
          <BlinkAnimation active={isFetching}>
            <div className="h-11 w-44 text-text-primary">
              <OrqestMark title={logoLabel} wordmark={appTitle} />
            </div>
          </BlinkAnimation>
          <div className="max-w-2xl">
            <p className="mb-5 w-max border-l border-border-heavy pl-3 font-mono text-xs uppercase tracking-[0.22em] text-text-secondary">
              {localize('com_auth_orqest_kicker')}
            </p>
            <h2 className="max-w-[18ch] text-4xl font-semibold leading-[1.05] tracking-tight text-text-primary xl:text-5xl">
              {localize('com_auth_orqest_headline')}
            </h2>
            <p className="mt-5 max-w-[46ch] text-lg leading-8 text-text-secondary">
              {localize('com_auth_orqest_description')}
            </p>
            <p className="mt-8 max-w-[48ch] text-sm font-semibold uppercase leading-6 tracking-[0.16em] text-text-tertiary">
              {localize('com_auth_orqest_footer')}
            </p>
            <div className="mt-10 grid h-64 max-w-xl grid-cols-5 gap-3">
              <div className="col-span-2 rounded-2xl border border-border-light bg-surface-secondary p-5 shadow-sm">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                  {localize('com_auth_orqest_metric_briefing')}
                </p>
                <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
                  {localize('com_auth_orqest_metric_briefing_time')}
                </p>
              </div>
              <div className="col-span-3 rounded-2xl border border-border-light bg-surface-primary-alt p-5 shadow-sm">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                  {localize('com_auth_orqest_metric_script')}
                </p>
                <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
                  {localize('com_auth_orqest_metric_script_time')}
                </p>
              </div>
              <div className="col-span-3 rounded-2xl border border-border-light bg-surface-tertiary p-5 shadow-sm">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                  {localize('com_auth_orqest_metric_topics')}
                </p>
                <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
                  {localize('com_auth_orqest_metric_topics_count')}
                </p>
              </div>
              <div className="bg-surface-submit/15 col-span-2 rounded-2xl border border-border-light p-5 shadow-sm">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                  {localize('com_auth_orqest_metric_report')}
                </p>
                <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
                  {localize('com_auth_orqest_metric_report_sources')}
                </p>
              </div>
            </div>
          </div>
          <Footer startupConfig={startupConfig} />
        </section>

        <main className="flex min-h-dvh flex-col justify-center px-5 py-8 sm:px-8">
          <BlinkAnimation active={isFetching}>
            <div className="mx-auto mb-8 h-10 w-40 text-text-primary lg:hidden">
              <OrqestMark title={logoLabel} wordmark={appTitle} />
            </div>
          </BlinkAnimation>
          <DisplayError />
          <div className="bg-surface-dialog/90 mx-auto w-full max-w-[25rem] rounded-3xl border border-border-light p-6 shadow-2xl shadow-black/[0.08] backdrop-blur-xl dark:shadow-black/30 sm:p-7">
            {!hasStartupConfigError && !isFetching && header && (
              <h1
                className="mb-5 text-center text-3xl font-semibold leading-tight text-text-primary"
                style={{ userSelect: 'none' }}
              >
                {header}
              </h1>
            )}
            {children}
            {!pathname.includes('2fa') &&
              (pathname.includes('login') || pathname.includes('register')) && (
                <SocialLoginRender startupConfig={startupConfig} />
              )}
          </div>
          <div className="mt-8 lg:hidden">
            <Footer startupConfig={startupConfig} />
          </div>
        </main>

        <div className="absolute bottom-4 left-4">
          <ThemeSelector />
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
