/**
 * بروكسي تطوير صغير لتجربة تطبيقات Flutter على الويب ضدّ الـ backend الإنتاجي.
 *
 * المشكلة: الإنتاج (api.phi-bit.com) يسمح بـ CORS لنطاقات اللوحات فقط، فيحجب
 * طلبات متصفّح من http://localhost:8090/8091. التطبيقات الأصلية (Android/iOS)
 * لا ترسل ترويسة Origin فلا تتأثّر، لكن الويب يتأثّر.
 *
 * الحلّ: يستمع هذا البروكسي على http://localhost:3000 (حيث توجّه التطبيقات
 * أصلاً عبر --dart-define=API_URL=http://localhost:3000/api/v1)، ويعيد توجيه
 * كل طلب إلى https://api.phi-bit.com (خادم-لخادم، لا قيد CORS)، ثم يضيف
 * ترويسات CORS متساهلة في الاستجابة كي يقبلها المتصفّح.
 *
 * لا يغيّر شيئاً على الإنتاج، ولا يحتاج بيانات اعتماد. للتطوير المحلي فقط.
 *
 * التشغيل:  node mobile-flutter/dev-cors-proxy.cjs
 */
const http = require('http');
const https = require('https');

const TARGET_HOST = 'api.phi-bit.com';
const PORT = 3000;

const server = http.createServer((req, res) => {
  // ترويسات CORS للمتصفّح (نعكس الـ Origin لدعم credentials).
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    req.headers['access-control-request-headers'] || 'content-type,authorization',
  );

  // ردّ فوري على preflight.
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // أعِد بناء الترويسات للوجهة: انزع Origin/Referer واضبط Host.
  const headers = { ...req.headers, host: TARGET_HOST };
  delete headers.origin;
  delete headers.referer;

  const proxyReq = https.request(
    { hostname: TARGET_HOST, port: 443, path: req.url, method: req.method, headers },
    (proxyRes) => {
      // مرّر ترويسات الوجهة لكن انزع أي CORS منها (نضع ترويساتنا).
      const h = { ...proxyRes.headers };
      delete h['access-control-allow-origin'];
      delete h['access-control-allow-credentials'];
      res.writeHead(proxyRes.statusCode || 502, h);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', (e) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ proxyError: e.message }));
  });
  req.pipe(proxyReq);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`CORS proxy ready: http://localhost:${PORT}  ->  https://${TARGET_HOST}`);
});
