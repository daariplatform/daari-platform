'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearTokens, getAccessToken } from '@/lib/api';
import { resetPostHog, trackEvent } from '@/lib/posthog';
import { useEffect } from 'react';
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
} from 'lucide-react';

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
  { href: '/dashboard/notifications', label: 'التنبيهات', icon: Bell },
  { href: '/dashboard/reports', label: 'التقارير', icon: BarChart3 },
  { href: '/dashboard/subscription', label: 'الاشتراك والعروض', icon: Crown },
  { href: '/dashboard/audit-log', label: 'سجل التعديلات', icon: History },
  { href: '/dashboard/settings', label: 'الإعدادات', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!getAccessToken()) router.push('/login');
  }, [router]);

  function logout() {
    trackEvent('logout');
    resetPostHog();
    clearTokens();
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-l shadow-sm flex flex-col">
        <div className="p-5 border-b">
          <h2 className="font-bold text-primary-700 text-xl">منصة داري</h2>
          <p className="text-xs text-slate-500 mt-1">لوحة المعمل</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
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
        </nav>
        <button
          onClick={logout}
          className="m-3 flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50"
        >
          <LogOut size={18} />
          <span>تسجيل خروج</span>
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
