'use client';

/**
 * Bulk customer import (Excel).
 *
 * Flow:
 *   1. Download template (zero state)
 *   2. Pick .xlsx file
 *   3. Preview parsed rows (server-side parse for validation)
 *   4. Confirm → server creates User + Customer for each valid row
 *   5. Show printable credentials list (window.print() for plant to distribute)
 */

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ImportRow {
  rowNumber: number;
  fullName?: string;
  phone?: string;
  district?: string;
  tankNumber?: string;
  addressLine?: string;
  errors?: string[];
}

interface PreviewResponse {
  rows: ImportRow[];
  summary: { total: number; valid: number; invalid: number };
}

interface CommitResponse {
  ok?: boolean;
  message?: string;
  rows?: ImportRow[];
  created?: Array<{ fullName: string; phone: string; password: string; district: string }>;
  skipped?: {
    invalid: Array<{ row: number; fullName?: string; phone?: string; reasons: string[] }>;
    existing: Array<{ row: number; fullName?: string; phone?: string; reason: string }>;
  };
  summary?: {
    totalRows: number;
    created: number;
    skippedInvalid: number;
    skippedExisting: number;
  };
}

type Stage = 'pick' | 'preview' | 'committing' | 'done';

export function BulkImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<CommitResponse | null>(null);

  const previewMutation = useMutation<PreviewResponse, unknown, File>({
    mutationFn: async (f) => {
      const fd = new FormData();
      fd.append('file', f);
      const r = await api.post<PreviewResponse>('/customers/import/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return r.data;
    },
    onSuccess: (data) => {
      setPreview(data);
      setStage('preview');
    },
  });

  const commitMutation = useMutation<CommitResponse, unknown, { file: File; skipInvalid: boolean }>(
    {
      mutationFn: async ({ file: f, skipInvalid }) => {
        const fd = new FormData();
        fd.append('file', f);
        // skipInvalid في query — أبسط من body مع multipart
        const r = await api.post<CommitResponse>(
          `/customers/import/commit?skipInvalid=${skipInvalid}`,
          fd,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 5 * 60 * 1000,
          },
        );
        return r.data;
      },
      onSuccess: (data) => {
        setResult(data);
        setStage('done');
        if (data.created && data.created.length > 0) onImported();
      },
    },
  );

  const downloadTemplate = async () => {
    const r = await api.get('/customers/import/template', { responseType: 'blob' });
    const blob = new Blob([r.data as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daari-customers-template.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printCredentials = () => {
    if (!result?.created) return;
    // open print window — independent so we can style RTL Arabic without polluting dashboard
    const html = buildPrintableHTML(result.created);
    const win = window.open('', '_blank');
    if (!win) {
      alert('سمح بالنوافذ المنبثقة لطباعة كلمات السر');
      return;
    }
    win.document.write(html);
    win.document.close();
    // Wait for browser to render before triggering print
    win.onload = () => {
      win.focus();
      win.print();
    };
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">استيراد زبائن من ملف Excel</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">
            ×
          </button>
        </div>

        {/* ── المرحلة 1: اختيار ملف ── */}
        {stage === 'pick' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              يدعم رفع حتى 5000 زبون دفعة واحدة. الـ Excel يجب أن يحوي على الأقل عمودَي{' '}
              <b>الاسم</b> و <b>رقم الهاتف</b>.
            </p>

            <div className="bg-aqua-50 border border-aqua-200 rounded-lg p-3 text-sm">
              <b>الخطوة الأولى:</b>{' '}
              <button
                onClick={downloadTemplate}
                className="text-aqua-700 underline hover:text-aqua-900"
              >
                نزّل قالب Excel فارغ
              </button>{' '}
              — يحوي ترويسات جاهزة + صف مثال. احذف صف المثال قبل أن تحفظ.
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2 bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg text-sm font-medium"
              >
                {file ? `📄 ${file.name}` : '+ اختر ملف Excel'}
              </button>
              {file && (
                <p className="text-xs text-slate-500 mt-2">
                  حجم الملف: {(file.size / 1024).toFixed(1)} كيلوبايت
                </p>
              )}
            </div>

            {previewMutation.isError && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                {(previewMutation.error as { response?: { data?: { message?: string } } })?.response
                  ?.data?.message ?? 'فشل قراءة الملف'}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => file && previewMutation.mutate(file)}
                disabled={!file || previewMutation.isPending}
                className="px-4 py-2 bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {previewMutation.isPending ? 'جارٍ التحليل...' : 'معاينة'}
              </button>
            </div>
          </div>
        )}

        {/* ── المرحلة 2: معاينة + أخطاء ── */}
        {stage === 'preview' && preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <Stat label="إجمالي" value={preview.summary.total} color="slate" />
              <Stat label="صالحة للاستيراد" value={preview.summary.valid} color="emerald" />
              <Stat label="فيها أخطاء" value={preview.summary.invalid} color="red" />
            </div>

            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-right">صف</th>
                    <th className="px-2 py-1 text-right">الاسم</th>
                    <th className="px-2 py-1 text-right">الهاتف</th>
                    <th className="px-2 py-1 text-right">المنطقة</th>
                    <th className="px-2 py-1 text-right">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 200).map((r) => (
                    <tr
                      key={r.rowNumber}
                      className={`border-t ${r.errors?.length ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-2 py-1 text-slate-500">{r.rowNumber}</td>
                      <td className="px-2 py-1">{r.fullName ?? '—'}</td>
                      <td className="px-2 py-1 font-mono" dir="ltr">
                        {r.phone ?? '—'}
                      </td>
                      <td className="px-2 py-1">{r.district ?? '—'}</td>
                      <td className="px-2 py-1">
                        {r.errors?.length ? (
                          <span className="text-red-700">{r.errors.join(' · ')}</span>
                        ) : (
                          <span className="text-emerald-700">✓ صالح</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 200 && (
                <div className="text-center text-xs text-slate-500 p-2">
                  عرض أول 200 صف فقط — الإجمالي {preview.rows.length}
                </div>
              )}
            </div>

            {commitMutation.isError && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                {(() => {
                  const err = commitMutation.error as {
                    response?: { data?: { message?: string | string[] } };
                    message?: string;
                  };
                  const m = err?.response?.data?.message ?? err?.message ?? 'فشل الاستيراد';
                  return Array.isArray(m) ? m.join(' · ') : m;
                })()}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setStage('pick')}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-slate-50"
              >
                رجوع
              </button>
              <button
                disabled={preview.summary.valid === 0 || commitMutation.isPending || !file}
                onClick={() =>
                  file &&
                  commitMutation.mutate({
                    file,
                    skipInvalid: preview.summary.invalid > 0,
                  })
                }
                className="px-4 py-2 bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {commitMutation.isPending
                  ? 'جارٍ الإنشاء... قد يستغرق دقيقة'
                  : `استيراد ${preview.summary.valid} زبون`}
              </button>
            </div>
          </div>
        )}

        {/* ── المرحلة 3: النتيجة + طباعة ── */}
        {stage === 'done' && result && (
          <div className="space-y-3">
            {result.summary && (
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <Stat label="مُنشأ" value={result.summary.created} color="emerald" />
                <Stat label="مكرّر" value={result.summary.skippedExisting} color="slate" />
                <Stat label="أخطاء" value={result.summary.skippedInvalid} color="red" />
                <Stat label="إجمالي" value={result.summary.totalRows} color="aqua" />
              </div>
            )}

            {result.created && result.created.length > 0 && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                  <b>⚠️ كلمات السر تُعرض مرة واحدة فقط.</b> اضغط "طباعة" وسلّم الورقة للزبون
                  مباشرة. إذا فقدتها، استعمل "إعادة تعيين كلمة المرور" من قائمة الزبائن.
                </div>

                <div className="max-h-72 overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-right">الاسم</th>
                        <th className="px-2 py-1 text-right">الهاتف</th>
                        <th className="px-2 py-1 text-right">كلمة المرور</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.created.map((c, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{c.fullName}</td>
                          <td className="px-2 py-1 font-mono" dir="ltr">
                            {c.phone}
                          </td>
                          <td className="px-2 py-1 font-mono font-bold" dir="ltr">
                            {c.password}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">
                إغلاق
              </button>
              {result.created && result.created.length > 0 && (
                <button
                  onClick={printCredentials}
                  className="px-4 py-2 bg-aqua-600 hover:bg-aqua-700 text-white rounded-lg text-sm font-medium"
                >
                  🖨️ طباعة كلمات السر
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'emerald' | 'red' | 'slate' | 'aqua';
}) {
  const colorClass = {
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-50 text-slate-700',
    aqua: 'bg-aqua-50 text-aqua-700',
  }[color];
  return (
    <div className={`p-2 rounded ${colorClass}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

function buildPrintableHTML(
  rows: Array<{ fullName: string; phone: string; password: string; district: string }>,
): string {
  const today = new Date().toLocaleDateString('ar-IQ');
  const rowsHtml = rows
    .map(
      (r, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${escapeHtml(r.fullName)}</td>
      <td class="mono ltr">${escapeHtml(r.phone)}</td>
      <td class="mono ltr bold">${escapeHtml(r.password)}</td>
      <td>${escapeHtml(r.district)}</td>
    </tr>
  `,
    )
    .join('');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>كلمات سر الزبائن — ${today}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, system-ui, "Segoe UI", Tahoma, Arial;
      padding: 18px;
      direction: rtl;
      color: #0f172a;
    }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 16px; }
    .meta b { color: #0f172a; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    thead th {
      background: #0891b2;
      color: white;
      padding: 8px 10px;
      text-align: right;
      font-weight: 600;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:nth-child(even) td { background: #f8fafc; }
    .num { color: #94a3b8; width: 32px; }
    .mono { font-family: "SF Mono", Menlo, Consolas, monospace; }
    .ltr { direction: ltr; text-align: left; unicode-bidi: embed; }
    .bold { font-weight: 700; color: #0891b2; }
    .footer {
      margin-top: 14px;
      font-size: 11px;
      color: #64748b;
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
    }
    @page { size: A4; margin: 12mm; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>قائمة الدخول للزبائن — معمل المياه</h1>
  <div class="meta">
    تاريخ التوليد: <b>${today}</b> · عدد الحسابات: <b>${rows.length}</b>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>الاسم</th>
        <th>رقم الهاتف</th>
        <th>كلمة المرور</th>
        <th>المنطقة</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">
    على الزبون استخدام رقم هاتفه + كلمة المرور أعلاه لتسجيل الدخول في تطبيق <b>داري</b>.
    يُنصح بتغيير كلمة المرور من داخل التطبيق بعد أول دخول.
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
