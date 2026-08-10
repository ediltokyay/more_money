/**
 * node --test test/panel.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createPanelServer, olaySinifla, guvenliRaporAdi } from '../src/panel-server.mjs';
import { REPORT_DIR } from '../src/config.mjs';

test('olaySinifla ajan satırlarini tanir', () => {
  assert.equal(olaySinifla('# run 2026-08-10-abcd | saglayici=mock').tip, 'run');
  assert.equal(olaySinifla('kasif: 12 fikir').tip, 'kasif');
  assert.equal(olaySinifla('  - bir fikir -> 72 (onayli)').tip, 'sonuc');
  assert.equal(olaySinifla('  ! denetim:x deneme 1/3 basarisiz: boom').seviye, 'uyari');
  assert.equal(olaySinifla('HATA: patladi').seviye, 'hata');
});

test('guvenliRaporAdi path traversal engeller', () => {
  assert.equal(guvenliRaporAdi('2026-08-10.md'), '2026-08-10.md');
  assert.equal(guvenliRaporAdi('../secret.md'), null);
  assert.equal(guvenliRaporAdi('a/b.md'), null);
  assert.equal(guvenliRaporAdi('not-md.txt'), null);
});

function istek(port, method, yol, body) {
  return new Promise((cozum, red) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, method, path: yol, headers: body ? { 'content-type': 'application/json' } : {} },
      (res) => {
        let veri = '';
        res.setEncoding('utf8');
        res.on('data', (d) => (veri += d));
        res.on('end', () => cozum({ status: res.statusCode, headers: res.headers, body: veri }));
      }
    );
    req.on('error', red);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test('panel: kuru tur + rapor listesi + indirme', async () => {
  const { server, host, port } = createPanelServer({ host: '127.0.0.1', port: 0 });
  await new Promise((r) => server.listen(0, host, r));
  const gercekPort = server.address().port;

  try {
    const status = await istek(gercekPort, 'GET', '/api/status');
    assert.equal(status.status, 200);
    assert.equal(JSON.parse(status.body).calisiyor, false);

    const html = await istek(gercekPort, 'GET', '/');
    assert.equal(html.status, 200);
    assert.match(html.body, /Para ajanları/);

    const baslat = await istek(gercekPort, 'POST', '/api/run', { kuru: true });
    assert.equal(baslat.status, 202);
    assert.equal(JSON.parse(baslat.body).calisiyor, true);

    // Tur bitsin
    let bitti = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const s = JSON.parse((await istek(gercekPort, 'GET', '/api/status')).body);
      if (!s.calisiyor) {
        bitti = true;
        assert.ok(s.run?.raporAdi, 'rapor adi olmali');
        const ad = s.run.raporAdi;
        const rapor = await istek(gercekPort, 'GET', `/api/reports/${encodeURIComponent(ad)}`);
        assert.equal(rapor.status, 200);
        assert.match(rapor.body, /# /);
        const indir = await istek(gercekPort, 'GET', `/api/reports/${encodeURIComponent(ad)}/download`);
        assert.equal(indir.status, 200);
        assert.match(String(indir.headers['content-disposition'] || ''), /attachment/);
        break;
      }
    }
    assert.ok(bitti, 'kuru tur makul surede bitmeli');

    const liste = JSON.parse((await istek(gercekPort, 'GET', '/api/reports')).body);
    assert.ok(liste.raporlar.length >= 1);

    const cift = await istek(gercekPort, 'POST', '/api/run', { kuru: true });
    // Tur bitmis olmali; yeni tur 202. Eger hala calisiyorsa 409 — ikisi de kabul, ama bitmis olmali.
    assert.ok([202, 409].includes(cift.status));
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('panel rapor klasoru ornek raporu gorur', () => {
  assert.ok(fs.existsSync(path.join(REPORT_DIR, 'ornek-rapor.md')));
});
