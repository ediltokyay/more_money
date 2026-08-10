#!/usr/bin/env node
/**
 * Operator paneli.
 *
 *   npm run panel
 *   npm run panel -- --port 8787
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

const port = Number(deger('--port', process.env.MONEY_PANEL_PORT || 8787));
const host = deger('--host', process.env.MONEY_PANEL_HOST || '127.0.0.1');
const { server } = createPanelServer({ host, port });

server.listen(port, host, () => {
  console.log(`para ajanlari paneli → http://${host}:${port}`);
  console.log('Ctrl+C ile durdur.');
});
