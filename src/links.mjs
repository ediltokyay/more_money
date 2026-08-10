/**
 * Kanit linklerini GERCEKTEN HTTP ile dogrular.
 *
 * Modelin "kaynak: https://statista.com/..." demesi kanit degildir; modeller link uydurur.
 * Burada acilmayan link fikre ceza yazar (score.mjs). Bu, sistemdeki tek insan-disi gercek olcum.
 */

const SAHTE_KALIP = /(example\.(com|org)|yourdomain|site\.com|placeholder|lorem|xxx|test\.com)/i;

export function urlToplaFromDosya(dosya) {
  const urls = [];
  for (const k of dosya?.pazarKaniti || []) if (k?.kaynakUrl) urls.push(String(k.kaynakUrl));
  for (const r of dosya?.rakipler || []) if (r?.url) urls.push(String(r.url));
  return [...new Set(urls)];
}

async function tekLink(url, timeoutMs) {
  if (SAHTE_KALIP.test(url)) return { url, ok: false, kod: 0, not: 'sahte gorunumlu URL' };
  let u;
  try {
    u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error('protokol');
  } catch {
    return { url, ok: false, kod: 0, not: 'gecersiz URL' };
  }

  const iste = async (method) =>
    fetch(u.href, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; money-agents/1.0)' }
    });

  try {
    let r = await iste('HEAD');
    if (r.status === 405 || r.status === 403 || r.status === 501) r = await iste('GET');
    return { url, ok: r.status >= 200 && r.status < 400, kod: r.status, not: r.status >= 400 ? 'HTTP hata' : '' };
  } catch (e) {
    return { url, ok: false, kod: 0, not: String(e.name === 'TimeoutError' ? 'zaman asimi' : e.message).slice(0, 80) };
  }
}

export async function linkleriDogrula(urls, { timeoutMs = 8000, esZamanli = 4, aktif = true } = {}) {
  if (!aktif) return { kontrolEdildi: false, toplam: urls.length, calisan: 0, detay: [] };
  const detay = [];
  const kuyruk = [...urls];
  const isciler = Array.from({ length: Math.min(esZamanli, Math.max(1, kuyruk.length)) }, async () => {
    for (;;) {
      const url = kuyruk.shift();
      if (!url) return;
      detay.push(await tekLink(url, timeoutMs));
    }
  });
  await Promise.all(isciler);
  return { kontrolEdildi: true, toplam: detay.length, calisan: detay.filter((d) => d.ok).length, detay };
}
