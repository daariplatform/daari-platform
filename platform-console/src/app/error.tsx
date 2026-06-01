'use client';

/**
 * Route-level error boundary. Catches any unhandled error thrown by a
 * page component or its data-fetching hooks (TanStack Query throws into
 * this when `useQuery({ suspense: true })`-style fetches reject, and
 * any direct `throw` in a render).
 *
 * Without this file Next.js shows the default "Application error: a
 * client-side exception has occurred" with no recovery option — what
 * triggered Ahmed's bug report when one stale walk-in row crashed the
 * orders page. With it, the user sees an Arabic-localised retry
 * affordance and the underlying error is reported to Sentry (via the
 * `digest` field if Next.js adds it).
 */
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort report. Sentry's Next.js integration auto-captures
    // here too via the `digest` plumbing, but this guarantees we see
    // it in dev/console as well.
    // eslint-disable-next-line no-console
    console.error('[error-boundary]', error);
  }, [error]);

  return (
    <main
      dir="rtl"
      className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center"
    >
      <div className="text-5xl mb-3">⚠️</div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">حدث خطأ غير متوقّع</h1>
      <p className="text-sm text-slate-600 max-w-md mb-6">
        لم نتمكّن من عرض هذه الصفحة. تم إعلام الفريق التقني تلقائيّاً. حاول
        إعادة التحميل، وإذا استمرّت المشكلة تواصل مع دعم داري.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold"
        >
          إعادة المحاولة
        </button>
        <a
          href="/dashboard"
          className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold"
        >
          العودة للرئيسية
        </a>
      </div>
      {error.digest && (
        <p className="mt-6 text-[11px] text-slate-400 font-mono">
          رمز الخطأ: {error.digest}
        </p>
      )}
    </main>
  );
}
