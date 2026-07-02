'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Crown, Send, MessageSquare, BarChart3, AlertTriangle } from 'lucide-react';

interface Usage {
  plan: 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  status: string;
  trialEndsAt: string | null;
  opsThisMonth: number;
  opsLimit: number;
  monthlyPriceIqd: number;
  usagePercent: number;
  nearLimit: boolean;
  overLimit: boolean;
}

interface PromoNotification {
  id: string;
  channel: 'PUSH' | 'WHATSAPP';
  title: string;
  body: string;
  audienceCount: number;
  sentCount: number;
  failedCount: number;
  priceIqd: number;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  sentAt: string | null;
  createdAt: string;
}

const PLAN_LABEL = {
  STARTER: 'Starter (مجاناً)',
  PRO: 'Pro (75,000 د.ع/شهر)',
  BUSINESS: 'Business (200,000 د.ع/شهر)',
  ENTERPRISE: 'Enterprise (400,000 د.ع/شهر)',
};

export default function SubscriptionPage() {
  const qc = useQueryClient();
  const [showCompose, setShowCompose] = useState(false);

  const {
    data: usage,
    isError: usageError,
    refetch: refetchUsage,
  } = useQuery<Usage>({
    queryKey: ['plant-usage'],
    queryFn: async () => (await api.get('/plant/usage')).data,
    refetchInterval: 60_000,
  });

  const { data: promoHistory } = useQuery<PromoNotification[]>({
    queryKey: ['promo-history'],
    queryFn: async () => (await api.get('/plant/promo-history')).data,
  });

  const promoMutation = useMutation({
    mutationFn: async (body: { title: string; body: string; channel: 'PUSH' | 'WHATSAPP' }) =>
      (await api.post('/plant/promo-blast', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promo-history'] });
      setShowCompose(false);
    },
    onError: (err) => {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'فشل الإرسال',
      );
    },
  });

  if (usageError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 text-sm mb-3">تعذّر تحميل بيانات الاشتراك.</p>
        <button
          onClick={() => refetchUsage()}
          className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }
  if (!usage) return <div className="h-32 bg-slate-100 animate-pulse rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الاشتراك والإشعارات الترويجية</h1>
        <p className="text-slate-500 text-sm mt-1">
          خطّتك الحالية، استخدامك الشهري، وأرسل عروض لزبائنك
        </p>
      </div>

      {/* Plan + Usage */}
      <div
        className="rounded-3xl p-6 text-white relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-purple-100 text-sm flex items-center gap-2">
              <Crown size={16} />
              خطّتك الحالية
            </p>
            <p className="text-3xl font-bold mt-1">{PLAN_LABEL[usage.plan]}</p>
            <p className="text-purple-100 text-xs mt-2">
              {usage.opsThisMonth.toLocaleString('ar-IQ')} عملية من {usage.opsLimit.toLocaleString('ar-IQ')} المتاحة هذا الشهر
            </p>
          </div>
          {usage.overLimit && (
            <div className="bg-red-500/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle size={14} />
              تخطّيت الحدّ
            </div>
          )}
          {usage.nearLimit && !usage.overLimit && (
            <div className="bg-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-bold">
              قارب الانتهاء
            </div>
          )}
        </div>
        {/* Bar */}
        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${usage.overLimit ? 'bg-red-300' : 'bg-white'}`}
            style={{ width: `${Math.min(100, usage.usagePercent)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-purple-100 mt-2">
          <span>{usage.usagePercent}%</span>
          <span>الإعادة بداية الشهر القادم</span>
        </div>
      </div>

      {/* Tier cards — each non-current plan now exposes an "upgrade via
          WhatsApp" link that opens wa.me with a pre-filled message to the
          PhiBit support number. Self-serve billing isn't built (Iraqi cards
          don't work with Stripe/PayPal), so WhatsApp + manual bank transfer
          is the actual conversion path. Audit found the previous design
          was just informational with no way for the plant to act. */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {(['STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const).map((p) => (
          <PlanCard
            key={p}
            plan={p}
            current={usage.plan}
            opsLimit={p === 'STARTER' ? 300 : p === 'PRO' ? 1500 : p === 'BUSINESS' ? 5000 : 999999}
            priceIqd={p === 'STARTER' ? 0 : p === 'PRO' ? 75000 : p === 'BUSINESS' ? 200000 : 400000}
          />
        ))}
      </div>

      {/* Promo blast */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Send size={18} className="text-emerald-600" />
              إرسال عرض ترويجي لزبائنك
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              push notification = 5,000 د.ع للكل · WhatsApp = 10,000 + 10 د.ع/رسالة
            </p>
          </div>
          <button
            onClick={() => setShowCompose(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold"
          >
            + كتابة عرض جديد
          </button>
        </div>

        {/* History */}
        <div className="mt-4">
          <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
            <BarChart3 size={14} />
            آخر العروض ({promoHistory?.length ?? 0})
          </h3>
          {!promoHistory || promoHistory.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">
              لم تُرسل أي عروض بعد
            </p>
          ) : (
            <div className="space-y-2">
              {promoHistory.map((p) => (
                <div
                  key={p.id}
                  className="border border-slate-200 rounded-xl p-3 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare
                        size={14}
                        className={p.channel === 'PUSH' ? 'text-sky-600' : 'text-emerald-600'}
                      />
                      <span className="font-bold text-sm">{p.title}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          p.status === 'SENT'
                            ? 'bg-emerald-50 text-emerald-700'
                            : p.status === 'FAILED'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.status === 'SENT'
                          ? `✓ ${p.sentCount}/${p.audienceCount}`
                          : p.status === 'FAILED'
                          ? '✗ فشل'
                          : 'بالطابور'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">{p.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(p.createdAt).toLocaleString('ar-IQ')}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-purple-700">
                      {p.priceIqd.toLocaleString('ar-IQ')} د.ع
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCompose && (
        <ComposeModal
          onCancel={() => setShowCompose(false)}
          onSubmit={(b) => promoMutation.mutate(b)}
          isPending={promoMutation.isPending}
        />
      )}
    </div>
  );
}

/**
 * PhiBit support number for billing. Hardcoded to Ahmed's WhatsApp from
 * the global PhiBit CLAUDE.md. Plants click "ترقية" → wa.me opens with a
 * prefilled Arabic message identifying the plant + the requested tier, so
 * Ahmed can confirm the bank transfer + flip the plan in /platform.
 */
const SUPPORT_WHATSAPP = '9647752222558';

function PlanCard({
  plan,
  current,
  opsLimit,
  priceIqd,
}: {
  plan: 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  current: 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  opsLimit: number;
  priceIqd: number;
}) {
  const isCurrent = plan === current;
  function openUpgradeChat() {
    const msg = encodeURIComponent(
      `مرحباً، أرغب بترقية اشتراك معملي إلى خطة ${plan}. الخطة الحالية: ${current}.`,
    );
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${msg}`, '_blank');
  }
  return (
    <div
      className={`rounded-xl border p-4 ${
        isCurrent ? 'border-purple-400 bg-purple-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm">{plan}</span>
        {isCurrent && (
          <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full">
            الحالية
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">
        {priceIqd === 0 ? 'مجاناً' : `${(priceIqd / 1000).toLocaleString('ar-IQ')} ألف`}
      </p>
      <p className="text-[11px] text-slate-500 mt-1">
        {opsLimit === 999999
          ? 'عمليات غير محدودة'
          : `${opsLimit.toLocaleString('ar-IQ')} عملية/شهر`}
      </p>
      {!isCurrent && (
        <button
          type="button"
          onClick={openUpgradeChat}
          className="mt-3 w-full text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg py-2 flex items-center justify-center gap-1.5"
        >
          <MessageSquare size={12} />
          ترقية عبر واتساب
        </button>
      )}
    </div>
  );
}

function ComposeModal({
  onCancel,
  onSubmit,
  isPending,
}: {
  onCancel: () => void;
  onSubmit: (b: { title: string; body: string; channel: 'PUSH' | 'WHATSAPP' }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<'PUSH' | 'WHATSAPP'>('PUSH');

  const canSubmit = title.length >= 3 && body.length >= 3;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" dir="rtl">
        <div>
          <h3 className="text-lg font-bold">عرض ترويجي جديد</h3>
          <p className="text-xs text-slate-500 mt-1">سيُرسل لكل زبائنك النشطين</p>
        </div>

        <div className="space-y-3">
          {/* Channel picker — WhatsApp blast button used to be permanently
              disabled with "(قريباً)". Backend `/plant/promo-blast` accepts
              `channel: WHATSAPP` and routes through the same Wassenger
              integration used for order confirmations, so it's wired up
              now. The price line below reminds plants of the cost. */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setChannel('PUSH')}
              className={`flex-1 py-3 rounded-xl border text-sm font-bold ${
                channel === 'PUSH'
                  ? 'bg-sky-50 border-sky-400 text-sky-700'
                  : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              📱 Push (5,000 د.ع)
            </button>
            <button
              type="button"
              onClick={() => setChannel('WHATSAPP')}
              className={`flex-1 py-3 rounded-xl border text-sm font-bold ${
                channel === 'WHATSAPP'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              💬 WhatsApp
            </button>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان قصير (مثلاً: خصم 20% اليوم!)"
            maxLength={80}
            className="w-full border border-slate-200 rounded-lg px-3 py-2"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="نص العرض (مثلاً: اليوم فقط، احصل على خصم 20% على كل التعبئات)"
            maxLength={280}
            rows={4}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 resize-none"
          />
          <p className="text-[10px] text-slate-400 text-right">
            {body.length} / 280 حرف
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium"
          >
            إلغاء
          </button>
          <button
            onClick={() => onSubmit({ title, body, channel })}
            disabled={!canSubmit || isPending}
            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {isPending ? 'جارٍ الإرسال...' : 'إرسال العرض'}
          </button>
        </div>
      </div>
    </div>
  );
}
