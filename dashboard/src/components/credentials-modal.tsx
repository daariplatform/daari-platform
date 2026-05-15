'use client';

import { useEffect, useState } from 'react';

interface Credentials {
  phone: string;
  password: string;
  fullName: string;
}

/**
 * One-shot reveal of a freshly-generated password. Displayed right after
 * creating a customer or driver, or after force-resetting their password.
 *
 * Design rules:
 *  - the password is shown ONCE; closing the modal removes it from the DOM
 *  - copy buttons for phone, password, and a pre-built WhatsApp message
 *  - explicit warning that this won't be shown again
 *
 * We deliberately do NOT echo the credentials to console / network logs —
 * the parent passes them in via props and lets React unmount them.
 */
export function CredentialsModal({
  credentials,
  onClose,
  role,
}: {
  credentials: Credentials | null;
  onClose: () => void;
  role: 'customer' | 'driver';
}) {
  const [copied, setCopied] = useState<'phone' | 'password' | 'whatsapp' | null>(null);

  // Auto-clear the "Copied!" indicator after 2s
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  if (!credentials) return null;

  const appName = role === 'customer' ? 'تطبيق داري' : 'تطبيق داري للعاملين';
  const whatsappMessage = `مرحباً ${credentials.fullName}،
تم إنشاء حسابك على ${appName}.
رقم الدخول: ${credentials.phone}
كلمة المرور: ${credentials.password}

نوصي بتغيير كلمة المرور بعد أول تسجيل دخول.`;

  function copy(text: string, kind: 'phone' | 'password' | 'whatsapp') {
    navigator.clipboard.writeText(text).then(() => setCopied(kind));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" dir="rtl">
        <div className="flex items-start gap-3">
          <div className="text-3xl">✅</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900">تم إنشاء الحساب بنجاح</h3>
            <p className="text-sm text-slate-500 mt-1">
              زوّد {role === 'customer' ? 'الزبون' : 'السائق'} بهذه البيانات لتسجيل الدخول.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-5">
          ⚠️ كلمة المرور تُعرض الآن فقط ولن تظهر مرة أخرى. انسخها واحفظها أو أرسلها مباشرة.
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">رقم الهاتف (يستخدم للدخول)</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={credentials.phone}
                dir="ltr"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-mono text-sm"
              />
              <button
                onClick={() => copy(credentials.phone, 'phone')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium"
              >
                {copied === 'phone' ? '✓ تم' : 'نسخ'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">كلمة المرور المؤقتة</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={credentials.password}
                dir="ltr"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-mono text-lg tracking-wider"
              />
              <button
                onClick={() => copy(credentials.password, 'password')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium"
              >
                {copied === 'password' ? '✓ تم' : 'نسخ'}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => copy(whatsappMessage, 'whatsapp')}
          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
        >
          {copied === 'whatsapp' ? '✓ تم نسخ الرسالة' : '📋 نسخ رسالة جاهزة للواتساب'}
        </button>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium"
        >
          فهمت، إغلاق
        </button>
      </div>
    </div>
  );
}
