#!/usr/bin/env node
/**
 * Operator paneli.
 *
 *   npm run panel
 *   npm run panel -- --port 8788
 *
 * Tarayici: http://127.0.0.1:8787
 * Sadece localhost — gercek tur baslatabildigi icin disari acma.
 */
import { createPanelServer } from './src/panel-server.mjs';

const argv = process.argv.slice(2);
function deger(ad, varsayilan) {
  const i = argv.indexOf(ad);
  if (i === -1) return varsayilan;
  return argv[i + 1] ?? varsayilan;
}

const istenenPort = Number(deger('--port', process.env.MONEY_PANEL_PORT || 8787));
const host = deger('--host', process.env.MONEY_PANEL_HOST || '127.0.0.1');
const sabitPort = argv.includes('--port') || Boolean(process.env.MONEY_PANEL_PORT);
const maxDeneme = sabitPort ? 1 : 20;

function dinle(port, deneme = 0) {
  const { server } = createPanelServer({ host, port });

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && deneme + 1 < maxDeneme) {
      const sonraki = port + 1;
      console.warn(`port ${port} dolu — ${sonraki} deneniyor…`);
      dinle(sonraki, deneme + 1);
      return;
    }
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} zaten kullanılıyor (EADDRINUSE).`);
      console.error('');
      console.error('Seçenekler:');
      console.error(`  1) Başka port:  npm run panel -- --port ${port + 1}`);
      console.error('  2) Eski paneli kapat: o CMD penceresinde Ctrl+C');
      console.error('  3) Windows’ta portu kim tutuyor:');
      console.error(`       netstat -ano | findstr :${port}`);
      console.error('       taskkill /PID <pid> /F');
      process.exit(1);
    }
    console.error(`Panel açılamadı: ${err.message}`);
    process.exit(1);
  });

  server.listen(port, host, () => {
    if (port !== istenenPort) {
      console.warn(`Not: ${istenenPort} doluydu, panel ${port} üzerinde.`);
    }
    console.log(`para ajanlari paneli → http://${host}:${port}`);
    console.log('Ctrl+C ile durdur.');
  });
}

dinle(istenenPort);
