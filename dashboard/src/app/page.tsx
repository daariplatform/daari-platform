import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary-700">منصة داري</h1>
        <p className="text-slate-600 mt-2">إدارة معامل المياه والتوصيل</p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-primary-600 px-6 py-3 text-white hover:bg-primary-700 transition"
        >
          تسجيل دخول
        </Link>
        {/* Self-signup is not live yet — plant owners onboard via a
            manual call with the Phi-Bit team. mailto: lets them contact
            us directly from the landing page without bouncing through
            a contact form. */}
        <a
          href="mailto:support@phi-bit.com?subject=طلب%20تسجيل%20معمل%20جديد%20على%20داري"
          className="rounded-lg border border-primary-600 text-primary-700 px-6 py-3 hover:bg-primary-50 transition"
        >
          سجّل معملك
        </a>
      </div>
      <p className="text-xs text-slate-400 max-w-md text-center">
        لاستفسارات الزبائن والسائقين: حمّل تطبيق داري من Google Play واطلب بياناتك من
        المعمل التابع له.
      </p>
    </main>
  );
}
