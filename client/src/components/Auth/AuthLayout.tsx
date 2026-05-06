import { ThemeSelector } from '@librechat/client';
import { TStartupConfig } from 'librechat-data-provider';
import { ErrorMessage } from '~/components/Auth/ErrorMessage';
import { TranslationKeys, useLocalize } from '~/hooks';
import SocialLoginRender from './SocialLoginRender';
import { BlinkAnimation } from './BlinkAnimation';
import { Banner } from '../Banners';
import Footer from './Footer';

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
            <div className="h-11 w-44">
              <img
                src="assets/logo.svg"
                className="h-full w-full object-contain object-left"
                alt={localize('com_ui_logo', { 0: startupConfig?.appTitle ?? 'Orqest' })}
              />
            </div>
          </BlinkAnimation>
          <div className="max-w-xl">
            <div className="mb-8 grid h-64 grid-cols-5 gap-3">
              <div className="col-span-2 rounded-2xl border border-border-light bg-surface-secondary shadow-sm" />
              <div className="col-span-3 rounded-2xl border border-border-light bg-surface-primary-alt shadow-sm" />
              <div className="col-span-3 rounded-2xl border border-border-light bg-surface-tertiary shadow-sm" />
              <div className="bg-surface-submit/15 col-span-2 rounded-2xl border border-border-light shadow-sm" />
            </div>
            <p className="max-w-md text-sm leading-6 text-text-secondary">
              {startupConfig?.appTitle ?? 'Orqest'}
            </p>
          </div>
          <Footer startupConfig={startupConfig} />
        </section>

        <main className="flex min-h-dvh flex-col justify-center px-5 py-8 sm:px-8">
          <BlinkAnimation active={isFetching}>
            <div className="mx-auto mb-8 h-10 w-40 lg:hidden">
              <img
                src="assets/logo.svg"
                className="h-full w-full object-contain"
                alt={localize('com_ui_logo', { 0: startupConfig?.appTitle ?? 'Orqest' })}
              />
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
