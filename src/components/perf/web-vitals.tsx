'use client';

import { useReportWebVitals } from 'next/web-vitals';

/**
 * Logs Core Web Vitals (FCP, LCP, CLS, INP, TTFB) to the dev
 * console (step 29). Step 88 swaps this for a real analytics
 * sink (Plausible / Vercel Analytics) keyed on the visitor's
 * cookie consent for the analytics category.
 *
 * Runs only in development to keep production console output
 * clean and to avoid leaking metric noise into customer-side
 * tooling. Returns `null` so it never affects layout.
 */
export function WebVitalsReporter(): null {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Web Vitals]', metric.name, Math.round(metric.value), metric);
    }
  });
  return null;
}
