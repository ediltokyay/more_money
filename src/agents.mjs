/**
 * Uc ajan rolu + cikti sema dogrulamasi.
 * Sema tutmazsa llm.json otomatik yeniden dener; yine tutmazsa fikir duser (sessizce gecmez).
 */
import { kasifPrompt, arastirmaciPrompt, denetciPrompt } from './prompts.mjs';
import { OLCULER } from './score.mjs';

const dizi = (v) => Array.isArray(v);

// Bos liste gecerli cevaptir: hariclar her seyi kapsiyorsa model yeni fikir bulamayabilir.
export function kasifSema(v) {
  if (!v || !dizi(v.fikirler)) return 'fikirler dizisi yok';
  for (const f of v.fikirler) {
    if (!f?.baslik || !f?.tekCumle) return 'fikirde baslik/tekCumle eksik';
  }
  return null;
}

export function arastirmaciSema(v) {
  if (!v?.baslik) return 'baslik yok';
  if (!dizi(v.ilkUcAdim) || v.ilkUcAdim.length < 1) return 'ilkUcAdim yok';
  if (!v.otonomi || typeof v.otonomi !== 'object') return 'otonomi yok';
  if (!v.olumKriteri) return 'olumKriteri yok';
  return null;
}

export function denetciSema(v) {
  if (!['kabul', 'sartli', 'red'].includes(v?.karar)) return 'karar gecersiz';
  if (!v.altSkorlar) return 'altSkorlar yok';
  for (const o of OLCULER) {
    const p = typeof v.altSkorlar[o] === 'number' ? v.altSkorlar[o] : v.altSkorlar[o]?.puan;
    if (!Number.isFinite(Number(p))) return `altSkor eksik: ${o}`;
  }
  return null;
}

export async function kasif(llm, cfg, { hariclar, adet }) {
  const { system, user } = kasifPrompt(cfg, { hariclar, adet });
  const v = await llm.json({ etiket: 'kasif', system, user, dogrula: kasifSema });
  return v.fikirler.slice(0, adet);
}

export async function arastirmaci(llm, cfg, fikir) {
  const { system, user } = arastirmaciPrompt(cfg, fikir);
  return llm.json({ etiket: `arastirma:${fikir.baslik?.slice(0, 30)}`, system, user, dogrula: arastirmaciSema });
}

export async function denetci(llm, cfg, dosya, linkRaporu) {
  const { system, user } = denetciPrompt(cfg, dosya, linkRaporu);
  return llm.json({
    etiket: `denetim:${dosya.baslik?.slice(0, 30)}`,
    system,
    user,
    model: cfg.llm.denetciModel || cfg.llm.model,
    temperature: cfg.llm.denetciTemperature ?? 0.1,
    dogrula: denetciSema
  });
}
