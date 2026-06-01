'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, clearTokens, getAccessToken } from '@/lib/api';
import { resetPostHog, trackEvent } from '@/lib/posthog';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Database,
  Droplet,
  Users,
  Truck,
  MapPin,
  ClipboardList,
  CreditCard,
  Bell,
  Settings,
  BarChart3,
  Crown,
  History,
  LogOut,
  Megaphone,
  Wallet,
  Banknote,
  Menu,
  X,
} from 'lucide-react';

interface MeShape {
  id: string;
  phone: string;
  role: string;
  tenantId: string | null;
}

// Next.js typed routes — cast href to any since dynamic + new routes break literal narrowing
const NAV: Array<{ href: string; label: string; icon: any }> = [
  { href: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { href: '/dashboard/tanks', label: 'الخزانات', icon: Database },
  { href: '/dashboard/stock', label: 'مخزون المياه', icon: Droplet },
  { href: '/dashboard/customers', label: 'الزبائن', icon: Users },
  { href: '/dashboard/drivers', label: 'السائقون', icon: Truck },
  { href: '/dashboard/drivers/live', label: 'تتبع مباشر', icon: MapPin },
  { href: '/dashboard/orders', label: 'الطلبات', icon: ClipboardList },
  { href: '/dashboard/accounting', label: 'المحاسبة', icon: CreditCard },
  { href: '/dashboard/cash', label: 'النقد', icon: Banknote },
  { href: '/dashboard/notifications', label: 'التنبيهات', icon: Bell },
  { href: '/dashboard/reports', label: 'التقارير', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'الإعدادات', icon: Settings },
  { href: '/dashboard/promos', label: 'العروض', icon: Megaphone },
  { href: '/dashboard/subscription', label: 'الاشتراك', icon: Crown },
  { href: '/dashboard/audit-log', label: 'سجل التعديلات', icon: History },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Mobile drawer state — closed by default; user taps the hamburger to
  // open. We auto-close on route change (`pathname`) so the drawer doesn't
  // sit open over the new page after a tap.
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) router.push('/login');
  }, [router]);

  // Close the drawer whenever the user navigates to a new page.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Platform-admin (Ahmed/PhiBit) only sees the "Wallets" admin row. We don't
  // want to surface it to plant owners since it'd 403 anyway, but more
  // importantly it'd be confusing.
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

  // The sidebar contents are shared between the persistent desktop aside
  // (md+) and the mobile slide-in drawer. Extracted so we don't duplicate
  // the NAV map.
  const sidebarContent = (
    <>
      <div className="p-5 border-b flex items-center justify-between">
        <div>
          <h2 className="font-bold text-primary-700 text-xl">منصة داري</h2>
          <p className="text-xs text-slate-500 mt-1">لوحة المعمل</p>
        </div>
        {/* Close button — only visible inside the mobile drawer. */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-2 -m-2 rounded-lg hover:bg-slate-100"
          aria-label="إغلاق القائمة"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                active ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {isPlatformAdmin && (
          <>
            <div className="pt-3 mt-3 border-t border-slate-200">
              <p className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                إدارة المنصّة
              </p>
            </div>
            <Link
              href={'/dashboard/platform/wallets' as any}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                pathname === '/dashboard/platform/wallets'
                  ? 'bg-primary-50 text-primary-700'
                  : 'hover:bg-slate-50'
              }`}
            >
              <Wallet size={18} />
              <span>محافظ المعامل</span>
            </Link>
          </>
        )}
      </nav>
      <button
        onClick={logout}
        className="m-3 flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50"
      >
        <LogOut size={18} />
        <span>تسجيل خروج</span>
      </button>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile top bar — only visible below the md breakpoint. Holds the
          hamburger + the brand mark so the user always sees they're in
          داري, and gives a tap target to open the drawer. */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b flex items-center justify-between px-4 py-3 shadow-sm">
        <h2 className="font-bold text-primary-700 text-lg">منصة داري</h2>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -m-2 rounded-lg hover:bg-slate-100"
          aria-label="فتح القائمة"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Desktop sidebar — pinned on the side, always visible at md+. */}
      <aside className="hidden md:flex w-64 bg-white border-l shadow-sm flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile drawer — slides in from the right (RTL); also dim-overlays
          the page so a tap outside dismisses it. */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-slate-900/40 z-40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="md:hidden fixed top-0 right-0 bottom-0 w-72 bg-white shadow-xl z-50 flex flex-col">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main content — padding eases up on mobile so the dashboard
          doesn't waste 32px on each side of a 360px-wide screen. */}
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
