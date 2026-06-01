import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary-700">داري · منصّة المالك</h1>
        <p className="text-slate-600 mt-2">لوحة تحكّم مالك المنصّة — كل المعامل في مكان واحد</p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-primary-600 px-6 py-3 text-white hover:bg-primary-700 transition"
        >
          دخول المالك
        </Link>
      </div>
      <p className="text-xs text-slate-400 max-w-md text-center">
        هذه لوحة خاصّة بمالك المنصّة. لإدارة معمل، استخدم لوحة المعمل المخصّصة له.
      </p>
    </main>
  );
}
