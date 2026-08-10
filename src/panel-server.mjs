/**
 * Operator paneli — yerel HTTP + SSE.
 * Bagimlilik yok. Varsayilan yalnizca localhost (gercek tur baslatabildigi icin).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, DATA_DIR, REPORT_DIR } from './config.mjs';
import { calistir, defterKaydet } from './pipeline.mjs';
import { raporYaz } from './report.mjs';
import { defterYukle } from './ledger.mjs';

const PANEL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'panel');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function json(res, kod, veri) {
  res.writeHead(kod, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(veri));
}

export function guvenliRaporAdi(ad) {
  const temiz = path.basename(String(ad || ''));
  if (!temiz || temiz !== ad || temiz.includes('..') || !temiz.endsWith('.md')) return null;
  return temiz;
}

export function raporListele() {
  if (!fs.existsSync(REPORT_DIR)) return [];
  return fs
    .readdirSync(REPORT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((ad) => {
      const yol = path.join(REPORT_DIR, ad);
      const st = fs.statSync(yol);
      return {
        ad,
        bayt: st.size,
        guncelleme: st.mtime.toISOString(),
        kuru: ad.startsWith('kuru-'),
        ornek: ad.startsWith('ornek')
      };
    })
    .sort((a, b) => (a.guncelleme < b.guncelleme ? 1 : -1));
}

export function olaySinifla(satir) {
  const s = String(satir);
  if (s.startsWith('# run')) return { tip: 'run', seviye: 'bilgi' };
  if (s.startsWith('kasif:')) return { tip: 'kasif', seviye: 'bilgi' };
  if (s.startsWith('tekrar filtresi:')) return { tip: 'filtre', seviye: 'bilgi' };
  if (s.startsWith('on eleme:')) return { tip: 'oneleme', seviye: 'bilgi' };
  if (s.startsWith('  - ')) return { tip: 'sonuc', seviye: 'bilgi' };
  if (s.startsWith('  … ') || s.startsWith('  ... ')) return { tip: 'bekliyor', seviye: 'bilgi' };
  if (s.startsWith('  ! ') || s.startsWith('! ')) return { tip: 'uyari', seviye: 'uyari' };
  if (s.startsWith('rapor:')) return { tip: 'rapor', seviye: 'bilgi' };
  if (s.startsWith('defter:')) return { tip: 'defter', seviye: 'bilgi' };
  if (s.startsWith('cagri:') || s.startsWith('maliyet:')) return { tip: 'maliyet', seviye: 'bilgi' };
  if (s.startsWith('uyari:')) return { tip: 'uyari', seviye: 'uyari' };
  if (s.startsWith('HATA:')) return { tip: 'hata', seviye: 'hata' };
  return { tip: 'log', seviye: 'bilgi' };
}

function statikYol(pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  if (rel.includes('..')) return null;
  const dosya = path.join(PANEL_DIR, rel);
  if (!dosya.startsWith(PANEL_DIR)) return null;
  if (!fs.existsSync(dosya) || fs.statSync(dosya).isDirectory()) return null;
  return dosya;
}

export function createPanelState() {
  const aboneler = new Set();
  const gecmis = [];
  const MAX_GECMIS = 400;
  let run = null;

  function yayin(olay) {
    const tam = { t: Date.now(), ...olay };
    gecmis.push(tam);
    if (gecmis.length > MAX_GECMIS) gecmis.splice(0, gecmis.length - MAX_GECMIS);
    const sat = `data: ${JSON.stringify(tam)}\n\n`;
    for (const res of aboneler) {
      try {
        res.write(sat);
      } catch {
        aboneler.delete(res);
      }
    }
    return tam;
  }

  function durum() {
    return {
      calisiyor: Boolean(run?.calisiyor),
      run: run
        ? {
            id: run.id,
            kuru: run.kuru,
            basladi: run.basladi,
            bitti: run.bitti,
            hata: run.hata,
            raporYolu: run.raporYolu,
            raporAdi: run.raporAdi,
            ozet: run.ozet
          }
        : null,
      raporSayisi: raporListele().length
    };
  }

  async function turBaslat({ kuru = true, forceNew = false } = {}) {
    if (run?.calisiyor) {
      const err = new Error('Zaten bir tur calisiyor');
      err.kod = 409;
      throw err;
    }

    const argv = [];
    if (kuru) argv.push('--dry-run');
    if (forceNew) argv.push('--force-new');
    const cfg = loadConfig(argv);

    run = {
      id: `panel-${Date.now().toString(36)}`,
      kuru: Boolean(cfg.calisma.kuru),
      calisiyor: true,
      basladi: new Date().toISOString(),
      bitti: null,
      hata: null,
      raporYolu: null,
      raporAdi: null,
      ozet: null
    };

    yayin({
      tip: 'durum',
      seviye: 'bilgi',
      metin: run.kuru ? 'Kuru tur basliyor (fixture, harcama yok)' : 'Gercek tur basliyor (Cursor CLI / API)'
    });

    const log = (satir) => yayin({ ...olaySinifla(satir), metin: String(satir) });

    (async () => {
      try {
        const sonuc = await calistir(cfg, { log, defterYolu: cfg.calisma.defterYolu });
        let raporYolu = null;
        if (cfg.calisma.raporYazma) {
          raporYolu = raporYaz(cfg, sonuc);
          defterKaydet(sonuc.defter, cfg.calisma.defterYolu);
          log(`rapor: ${raporYolu}`);
          log(`defter: ${sonuc.defter.fikirler.length} fikir`);
        }
        log(
          cfg.llm.saglayici === 'cursor'
            ? `cagri: ${sonuc.kullanim.cagri}/${cfg.akis.runCagriTavani} (Cursor havuzu, ${sonuc.kullanim.hata} yeniden deneme)`
            : `maliyet: $${sonuc.kullanim.usd.toFixed(4)} (${sonuc.kullanim.cagri} cagri, ${sonuc.kullanim.hata} yeniden deneme)`
        );
        if (sonuc.uyarilar.length) log(`uyari: ${sonuc.uyarilar.length}`);

        run.calisiyor = false;
        run.bitti = new Date().toISOString();
        run.raporYolu = raporYolu;
        run.raporAdi = raporYolu ? path.basename(raporYolu) : null;
        run.ozet = {
          runId: sonuc.runId,
          fikir: sonuc.defter.fikirler.length,
          arastirilan: sonuc.degerlendirmeler.length,
          kazanan: sonuc.kazanan?.fikir?.baslik || null,
          uyarilar: sonuc.uyarilar,
          cagri: sonuc.kullanim.cagri
        };
        yayin({
          tip: 'bitti',
          seviye: 'bilgi',
          metin: sonuc.kazanan
            ? `Tur bitti · kazanan: ${sonuc.kazanan.fikir.baslik}`
            : 'Tur bitti · bu turda onayli kazanan yok',
          raporAdi: run.raporAdi,
          ozet: run.ozet
        });
      } catch (e) {
        run.calisiyor = false;
        run.bitti = new Date().toISOString();
        run.hata = e.message;
        yayin({ tip: 'hata', seviye: 'hata', metin: `HATA: ${e.message}` });
      }
    })();

    return durum();
  }

  function sseBagla(req, res) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive'
    });
    res.write(
      `data: ${JSON.stringify({ t: Date.now(), tip: 'hello', seviye: 'bilgi', metin: 'panel baglandi', durum: durum() })}\n\n`
    );
    for (const o of gecmis.slice(-120)) res.write(`data: ${JSON.stringify(o)}\n\n`);
    aboneler.add(res);
    const keep = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keep);
      }
    }, 15000);
    req.on('close', () => {
      clearInterval(keep);
      aboneler.delete(res);
    });
  }

  async function handle(req, res) {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const { pathname } = url;

      if (req.method === 'GET' && pathname === '/api/status') return json(res, 200, durum());
      if (req.method === 'GET' && pathname === '/api/events') return sseBagla(req, res);

      if (req.method === 'GET' && pathname === '/api/ledger') {
        const kuru = url.searchParams.get('kuru') === '1';
        const yol = path.join(DATA_DIR, kuru ? 'ledger.dry.json' : 'ledger.json');
        return json(res, 200, defterYukle(yol));
      }

      if (req.method === 'GET' && pathname === '/api/reports') return json(res, 200, { raporlar: raporListele() });

      const raporMatch = pathname.match(/^\/api\/reports\/([^/]+)(\/download)?$/);
      if (req.method === 'GET' && raporMatch) {
        const ad = guvenliRaporAdi(decodeURIComponent(raporMatch[1]));
        if (!ad) return json(res, 400, { hata: 'gecersiz rapor adi' });
        const yol = path.join(REPORT_DIR, ad);
        if (!fs.existsSync(yol)) return json(res, 404, { hata: 'rapor yok' });
        const indir = Boolean(raporMatch[2]);
        res.writeHead(200, {
          'content-type': 'text/markdown; charset=utf-8',
          'cache-control': 'no-store',
          'content-disposition': `${indir ? 'attachment' : 'inline'}; filename="${ad}"`
        });
        return res.end(fs.readFileSync(yol));
      }

      if (req.method === 'POST' && pathname === '/api/run') {
        let govde = '';
        for await (const parca of req) govde += parca;
        let body = {};
        try {
          body = govde ? JSON.parse(govde) : {};
        } catch {
          return json(res, 400, { hata: 'JSON bekleniyordu' });
        }
        const kuru = !(body.kuru === false || body.dryRun === false || body.gercek === true);
        try {
          return json(res, 202, await turBaslat({ kuru, forceNew: Boolean(body.forceNew) }));
        } catch (e) {
          return json(res, e.kod || 500, { hata: e.message, durum: durum() });
        }
      }

      const dosya = statikYol(pathname);
      if (!dosya) return json(res, 404, { hata: 'bulunamadi' });
      const ext = path.extname(dosya);
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
      return res.end(fs.readFileSync(dosya));
    } catch (e) {
      return json(res, 500, { hata: e.message });
    }
  }

  return { PANEL_DIR, durum, yayin, turBaslat, handle, _test: { gecmis, aboneler } };
}

export function createPanelServer(opts = {}) {
  const host = opts.host || process.env.MONEY_PANEL_HOST || '127.0.0.1';
  const port = Number(opts.port || process.env.MONEY_PANEL_PORT || 8787);
  const state = createPanelState();
  const server = http.createServer((req, res) => state.handle(req, res));
  return { server, state, host, port };
}
