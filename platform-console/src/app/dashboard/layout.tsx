'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, clearTokens, getAccessToken } from '@/lib/api';
import { resetPostHog, trackEvent } from '@/lib/posthog';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Factory,
  Wallet,
  HeartPulse,
  ScrollText,
  Settings,
  LogOut,
  ShieldAlert,
  Menu,
  X,
} from 'lucide-react';

interface MeShape {
  id: string;
  phone: string;
  role: string;
  tenantId: string | null;
}

// Owner-console navigation — matches the approved mockup. These are the only
// routes the platform owner sees. Plant-scoped pages were removed.
// `exact` marks index-style routes that must NOT light up for sub-paths
// (otherwise "/dashboard" would stay active on every page).
const NAV: Array<{ href: string; label: string; icon: any; exact?: boolean }> = [
  { href: '/dashboard', label: 'نظرة عامة', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/plants', label: 'المعامل', icon: Factory },
  { href: '/dashboard/platform/wallets', label: 'محافظ العروض', icon: Wallet },
  { href: '/dashboard/health', label: 'صحة النظام', icon: HeartPulse },
];

// Routes that exist only as placeholders in the nav (no page yet). We render
// them as disabled rows so the sidebar matches the mockup without dead links.
const NAV_SOON: Array<{ label: string; icon: any }> = [
  { label: 'سجل التدقيق', icon: ScrollText },
  { label: 'الإعدادات', icon: Settings },
];

function isActive(pathname: string | null, href: string, exact?: boolean) {
  if (!pathname) return false;
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) router.push('/login');
  }, [router]);

  // Auto-close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Whole-console gate: only PLATFORM_ADMIN may see any platform data. A plant
  // owner who somehow lands here gets a clear "owner only" screen, never plant
  // data. The backend would 403 the data calls anyway, but the client gate is
  // clearer and avoids flashing empty tables.
  const meQuery = useQuery<MeShape>({
    queryKey: ['auth-me'],
    queryFn: async () => (await api.get<MeShape>('/auth/me')).data,
    enabled: typeof window !== 'undefined' && !!getAccessToken(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const isPlatformAdmin = meQuery.data?.role === 'PLATFORM_ADMIN';

  function logout() {
    trackEvent('logout');
    resetPostHog();
    clearTokens();
    router.push('/login');
  }

  // ── Gate screens ───────────────────────────────────────────────────────
  // Still resolving identity → neutral loading shell (don't flash either the
  // console or the reject screen).
  if (meQuery.isLoading || (!meQuery.data && !meQuery.isError)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-10 w-10 rounded-full border-2 border-aqua-200 border-t-aqua-600 animate-spin" />
      </div>
    );
  }

  // Identity resolved but not the owner (or token broke) → reject screen.
  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-50 mx-auto mb-4 flex items-center justify-center">
            <ShieldAlert size={32} className="text-red-600" />
          </div>
          <h2 className="font-bold text-slate-900 text-lg">هذه اللوحة لمالك المنصّة فقط</h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            ليس لديك صلاحية الوصول إلى لوحة مالك المنصّة. إن كنت صاحب معمل، استخدم
            لوحة معملك بدلاً من هذه.
          </p>
          <button
            onClick={logout}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold"
          >
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  // ── Owner console shell ──────────────────────────────────────────────────
  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex items-center justify-between px-2 pb-5 mb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: 'linear-gradient(135deg, #22d3ee, #0e7490)' }}
          >
            💧
          </div>
          <div className="leading-tight">
            <div className="font-black text-white text-lg">داري</div>
            <div className="text-[11px] font-bold text-aqua-400">منصّة المالك</div>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-2 -m-2 rounded-lg text-aqua-100 hover:bg-white/10"
          aria-label="إغلاق القائمة"
        >
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition ${
                active
                  ? 'text-white shadow-lg'
                  : 'text-aqua-100/80 hover:bg-white/[0.06] hover:text-white'
              }`}
              style={
                active
                  ? {
                      background: 'linear-gradient(120deg, #0891b2, #06b6d4)',
                      boxShadow: '0 8px 18px rgba(8,145,178,.35)',
                    }
                  : undefined
              }
            >
              <Icon size={19} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="text-[10.5px] font-extrabold text-aqua-100/40 tracking-wider px-3.5 pt-5 pb-1.5">
          النظام
        </div>
        {NAV_SOON.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold text-aqua-100/35 cursor-default select-none"
              title="قريباً"
            >
              <Icon size={19} className="shrink-0" />
              <span>{item.label}</span>
              <span className="ms-auto text-[10px] font-bold text-aqua-100/30">قريباً</span>
            </div>
          );
        })}
      </nav>

      {/* Owner identity footer */}
      <div className="mt-3 flex items-center gap-3 p-3 rounded-2xl bg-white/[0.06]">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-white"
          style={{ background: 'linear-gradient(135deg, #34d399, #059669)' }}
        >
          أ
        </div>
        <div className="leading-tight min-w-0 flex-1">
          <div className="text-[13px] font-extrabold text-white truncate">أحمد العاني</div>
          <div className="text-[10.5px] text-aqua-400 font-bold">مالك المنصّة</div>
        </div>
        <button
          onClick={logout}
          className="p-2 rounded-lg text-aqua-100/70 hover:text-white hover:bg-white/10"
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
        >
          <LogOut size={17} />
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-[#0b1f27] text-white flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💧</span>
          <span className="font-black">داري · منصّة المالك</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -m-2 rounded-lg hover:bg-white/10"
          aria-label="فتح القائمة"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Desktop sidebar (dark aqua gradient) */}
      <aside
        className="hidden md:flex w-64 flex-col p-4 sticky top-0 h-screen"
        style={{ background: 'linear-gradient(180deg, #0e2a33, #0b1f27)' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-slate-900/50 z-40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside
            className="md:hidden fixed top-0 right-0 bottom-0 w-72 z-50 flex flex-col p-4 shadow-2xl"
            style={{ background: 'linear-gradient(180deg, #0e2a33, #0b1f27)' }}
          >
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main */}
      <main className="flex-1 p-4 md:p-7 lg:p-8 min-w-0">{children}</main>
    </div>
  );
}
