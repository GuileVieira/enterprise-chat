export const ErrorMessage = ({ children }: { children: React.ReactNode }) => (
  <div
    role="alert"
    aria-live="assertive"
    className="relative mt-6 rounded-2xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-sm font-medium leading-6 text-text-primary shadow-sm shadow-black/[0.03] transition-all dark:border-red-400/20 dark:bg-red-400/[0.07] dark:shadow-black/20 sm:px-5"
  >
    <div className="text-pretty">{children}</div>
  </div>
);
