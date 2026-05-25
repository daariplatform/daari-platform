/**
 * Bulk import of customers from an Excel sheet.
 *
 * Use case: Iraqi water plant has 2000+ existing customers in a spreadsheet.
 * The plant owner uploads the Excel, we:
 *   1. Parse it (Arabic headers, lenient column mapping)
 *   2. Validate each row (phone format, duplicates, min fields)
 *   3. Create User + Customer rows in batches
 *   4. Return a structured result: created with plain passwords (for the
 *      plant to print and distribute), and skipped rows with reasons
 *
 * No WhatsApp/SMS is sent — credentials go on paper. This is intentional:
 * Iraqi SMS costs ~50 IQD/message, and the plant already meets the customer
 * face-to-face on delivery. The dashboard renders a print-ready page after
 * the import.
 *
 * Excel format (Arabic headers, see generateTemplate()):
 *   الاسم | رقم الهاتف | المنطقة | رقم الخزان | العنوان | ملاحظات
 *
 * English headers also accepted: name, phone, district, tank, address, notes.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ImportRow {
  rowNumber: number;
  fullName?: string;
  phone?: string;
  district?: string;
  tankNumber?: string;
  addressLine?: string;
  notes?: string;
  errors?: string[];
}

/** Header keys we recognize (lowercase, untrimmed) */
const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  // Arabic
  'الاسم': 'fullName',
  'اسم': 'fullName',
  'اسم الزبون': 'fullName',
  'رقم الهاتف': 'phone',
  'هاتف': 'phone',
  'الهاتف': 'phone',
  'الجوال': 'phone',
  'موبايل': 'phone',
  'المنطقة': 'district',
  'منطقة': 'district',
  'الحي': 'district',
  'رقم الخزان': 'tankNumber',
  'الخزان': 'tankNumber',
  'qr': 'tankNumber',
  'العنوان': 'addressLine',
  'عنوان': 'addressLine',
  'ملاحظات': 'notes',
  // English
  'name': 'fullName',
  'fullname': 'fullName',
  'phone': 'phone',
  'mobile': 'phone',
  'district': 'district',
  'tank': 'tankNumber',
  'tanknumber': 'tankNumber',
  'qrcode': 'tankNumber',
  'address': 'addressLine',
  'notes': 'notes',
};

@Injectable()
export class BulkImportService {
  /**
   * يفك ملف Excel ويُرجع صفوفه بهيئة منظّمة + الأخطاء.
   * لا يكتب أي شيء في DB — هذه مرحلة preview.
   */
  async parseExcel(buffer: Buffer): Promise<ImportRow[]> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('ملف فارغ');
    }
    // حد أقصى 10 MB لمنع DoS
    if (buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('حجم الملف يتجاوز 10 ميجابايت');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('فشل قراءة ملف Excel — تأكد أنه ملف xlsx صحيح');
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      throw new BadRequestException('الورقة فارغة أو لا تحتوي على بيانات');
    }

    // اقرأ صف الترويسة (Row 1) واستخرج خريطة العمود → الحقل
    const headerRow = sheet.getRow(1);
    const colMap: Record<number, keyof ImportRow> = {};
    headerRow.eachCell((cell, colNumber) => {
      const raw = String(cell.value ?? '').trim().toLowerCase().replace(/\s+/g, '');
      const normalized = raw.replace(/^.*\((.*)\).*$/, '$1'); // strip parenthetical hints
      const field = HEADER_ALIASES[raw] ?? HEADER_ALIASES[normalized] ?? HEADER_ALIASES[String(cell.value ?? '').trim()];
      if (field) colMap[colNumber] = field;
    });

    if (!Object.values(colMap).includes('fullName') || !Object.values(colMap).includes('phone')) {
      throw new BadRequestException(
        'الملف لا يحتوي على عمود "الاسم" و"رقم الهاتف" — استعمل القالب المرفق',
      );
    }

    const seenPhones = new Set<string>();
    const rows: ImportRow[] = [];
    const lastRow = Math.min(sheet.rowCount, 5001); // hard cap 5000 data rows

    for (let r = 2; r <= lastRow; r++) {
      const xlRow = sheet.getRow(r);
      if (xlRow.cellCount === 0) continue;

      const row: ImportRow = { rowNumber: r, errors: [] };
      for (const [colStr, field] of Object.entries(colMap)) {
        const cell = xlRow.getCell(Number(colStr));
        const value = cell.value;
        if (value === null || value === undefined) continue;
        // ExcelJS يرجع أحياناً {text, hyperlink, ...} للروابط
        const str = typeof value === 'object' && 'text' in (value as object)
          ? String((value as { text: unknown }).text)
          : String(value);
        (row as unknown as Record<string, string>)[field] = str.trim();
      }

      // skip empty rows (no name AND no phone)
      if (!row.fullName && !row.phone) continue;

      // التحقّق
      if (!row.fullName || row.fullName.length < 2) {
        row.errors!.push('الاسم مطلوب (حرفان على الأقل)');
      }
      if (!row.phone) {
        row.errors!.push('رقم الهاتف مطلوب');
      } else {
        // طبّع الرقم: شيل المسافات + خط + جميع المحارف غير الأرقام
        row.phone = row.phone.replace(/\D/g, '');
        // قبول 07X... أو 9647X... → نوحّد على 07X (11 رقم)
        if (row.phone.startsWith('964')) {
          row.phone = '0' + row.phone.slice(3);
        }
        if (!/^07[3-9]\d{8}$/.test(row.phone)) {
          row.errors!.push('رقم هاتف عراقي غير صحيح — يجب أن يبدأ بـ 07 وأن يحوي 11 رقماً');
        } else if (seenPhones.has(row.phone)) {
          row.errors!.push('رقم مكرّر داخل نفس الملف');
        } else {
          seenPhones.add(row.phone);
        }
      }
      if (!row.district) row.district = 'غير محدد';
      if (!row.addressLine) row.addressLine = '—';

      if (row.errors!.length === 0) delete row.errors;
      rows.push(row);
    }

    if (rows.length === 0) {
      throw new BadRequestException('الملف لا يحوي صفوف بيانات صالحة');
    }

    return rows;
  }

  /**
   * يولّد قالب Excel فارغ بترويسة عربية + صف مثال.
   * المعمل يحمّله، يملأ، ثم يرفعه.
   */
  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Daari Platform';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('الزبائن', {
      views: [{ rightToLeft: true }],
    });

    sheet.columns = [
      { header: 'الاسم', key: 'fullName', width: 30 },
      { header: 'رقم الهاتف', key: 'phone', width: 16 },
      { header: 'المنطقة', key: 'district', width: 20 },
      { header: 'رقم الخزان', key: 'tankNumber', width: 14 },
      { header: 'العنوان', key: 'addressLine', width: 36 },
      { header: 'ملاحظات', key: 'notes', width: 30 },
    ];

    // تنسيق صف الترويسة
    const header = sheet.getRow(1);
    header.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0891B2' },
    };
    header.height = 24;
    header.alignment = { horizontal: 'right', vertical: 'middle' };

    // صف مثال
    sheet.addRow({
      fullName: 'أحمد علي حسن',
      phone: '07712345678',
      district: 'الكرادة',
      tankNumber: 'T-001',
      addressLine: 'شارع 14 — قرب جامع الحسين',
      notes: 'يفضّل التوصيل صباحاً',
    });
    const example = sheet.getRow(2);
    example.font = { italic: true, color: { argb: 'FF94A3B8' } };

    // ملاحظات في النهاية
    sheet.addRow([]);
    const noteRow = sheet.addRow(['ملاحظات:']);
    noteRow.font = { bold: true };
    sheet.addRow(['1. احذف صف المثال قبل الحفظ.']);
    sheet.addRow(['2. رقم الهاتف لازم يبدأ بـ 07 ويكون 11 رقم.']);
    sheet.addRow(['3. الاسم ورقم الهاتف إلزاميان — البقية اختيارية.']);
    sheet.addRow(['4. الأرقام المكرّرة ستُتجاهل تلقائياً.']);
    sheet.addRow(['5. حد أقصى 5000 زبون لكل ملف.']);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
