import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:sqflite/sqflite.dart';

/// طابور الطفرات الأوفلاين للسائق — منقول من `worker/lib/offline-queue.ts`.
///
/// عند فشل الشبكة تُكتب العملية (إكمال طلب / استرجاع خزان / بيع فوري / تسجيل
/// زبون) في جدول SQLite محلي، ثم يصرّفها [flush] عند عودة الاتصال. هكذا يواصل
/// السائق العمل بإشارة صفر — حرجٌ في العراق.
///
/// الصفّ الواحد = طفرة معلّقة (method + path + body JSON). المُصرِّف يمرّ على
/// الصفوف الأقدم أولاً ويحذف عند 2xx، ويُسقِط أخطاء 4xx (عدا 401/408/429) لأن
/// إعادتها لن تنفع، ويتوقّف عند أول فشل شبكة كي لا يستنزف البطارية.
class OfflineQueue {
  OfflineQueue(this._dio);

  final Dio _dio;
  Database? _db;

  Future<Database> _open() async {
    final existing = _db;
    if (existing != null) return existing;
    final dir = await getDatabasesPath();
    final db = await openDatabase(
      '$dir/daari_worker.db',
      version: 1,
      onCreate: (db, _) => db.execute('''
        CREATE TABLE pending_mutations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          method TEXT NOT NULL,
          path TEXT NOT NULL,
          body TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retries INTEGER NOT NULL DEFAULT 0,
          last_error TEXT
        )
      '''),
    );
    _db = db;
    return db;
  }

  /// أضِف طفرة معلّقة (تُرسَل لاحقاً عند عودة الشبكة).
  Future<void> enqueue(String method, String path, Map<String, dynamic> body) async {
    final db = await _open();
    await db.insert('pending_mutations', {
      'method': method,
      'path': path,
      'body': jsonEncode(body),
      'created_at': DateTime.now().millisecondsSinceEpoch,
    });
  }

  /// عدد الطفرات المنتظرة المزامنة.
  Future<int> pendingCount() async {
    final db = await _open();
    final rows =
        await db.rawQuery('SELECT COUNT(*) AS n FROM pending_mutations');
    return Sqflite.firstIntValue(rows) ?? 0;
  }

  /// يحاول إرسال كل ما في الطابور (الأقدم أولاً). يتوقّف عند أول فشل شبكة.
  Future<({int ok, int failed})> flush() async {
    final db = await _open();
    final rows = await db.query('pending_mutations', orderBy: 'id ASC');
    var ok = 0;
    var failed = 0;
    for (final row in rows) {
      final id = row['id'] as int;
      try {
        await _dio.request<dynamic>(
          row['path'] as String,
          data: jsonDecode(row['body'] as String),
          options: Options(method: row['method'] as String),
        );
        await db.delete('pending_mutations', where: 'id = ?', whereArgs: [id]);
        ok++;
      } on DioException catch (e) {
        failed++;
        final status = e.response?.statusCode ?? 0;
        await db.update(
          'pending_mutations',
          {
            'retries': ((row['retries'] as int?) ?? 0) + 1,
            'last_error': e.message,
          },
          where: 'id = ?',
          whereArgs: [id],
        );
        // خطأ تحقّق دائم (4xx) لن تُصلحه الإعادة → احذفه. عدا 401/408/429.
        if (status >= 400 &&
            status < 500 &&
            status != 401 &&
            status != 408 &&
            status != 429) {
          await db
              .delete('pending_mutations', where: 'id = ?', whereArgs: [id]);
        }
        break; // توقّف عند أول فشل
      }
    }
    return (ok: ok, failed: failed);
  }
}
