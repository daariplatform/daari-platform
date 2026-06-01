/**
 * Default 404 page — Arabic-localised. Without this Next.js shows a
 * bare-bones "This page could not be found" in English.
 */
export default function NotFound() {
  return (
    <main
      dir="rtl"
      className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center"
    >
      <div className="text-5xl mb-3">🤷</div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">الصفحة غير موجودة</h1>
      <p className="text-sm text-slate-600 max-w-md mb-6">
        الرابط الذي طلبته غير موجود. تأكّد من العنوان أو عُد للوحة الرئيسية.
      </p>
      <a
        href="/dashboard"
        className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold"
      >
        العودة للرئيسية
      </a>
    </main>
  );
}
