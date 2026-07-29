export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || '';
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
export const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK || 'https://cal.com/orqest/diagnostico';
export const WEBHOOK_URL = process.env.WEBHOOK_URL || '';

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).gtag) {
    (
      window as unknown as Record<
        string,
        (name: string, action: string, params?: Record<string, unknown>) => void
      >
    ).gtag('event', eventName, params);
  }
}

export function trackPixel(eventName: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).fbq) {
    (window as unknown as { fbq: (...args: unknown[]) => void }).fbq('track', eventName, params);
  }
}
