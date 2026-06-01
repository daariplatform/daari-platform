import type { Metadata } from 'next';

export const metadata: Metadata = {
  // These pages are publicly indexable — they need to be reachable for
  // Play Store / App Store review even when nobody's logged in.
  robots: { index: true, follow: true },
};

/**
 * Bare layout for the legal pages. Bypasses the dashboard auth layout so
 * Play Store reviewers (and customers) can read them without a login.
 *
 * Mounted at /legal/* — deploy alongside the dashboard so the canonical
 * URLs are:
 *   https://daari-admin.phi-bit.com/legal/privacy
 *   https://daari-admin.phi-bit.com/legal/terms
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-aqua-600 text-white py-4 shadow-md">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between">
          <a href="https://phi-bit.com" className="text-sm opacity-80 hover:opacity-100">
            phi-bit.com
          </a>
          <div className="text-lg font-bold">داري</div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8" dir="rtl">
        <article className="bg-white rounded-2xl shadow-sm p-8 prose prose-slate max-w-none">
          {children}
        </article>
        <footer className="text-center text-xs text-slate-400 mt-6 py-4">
          © 2026 Phi-Bit — أحمد العاني · بغداد، العراق
        </footer>
      </main>
    </div>
  );
}
