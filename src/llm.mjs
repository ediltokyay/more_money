/**
 * Saglayici bagimsiz LLM istemcisi (bagimlilik yok, Node 18+ fetch).
 *
 *   saglayici: 'cursor'        -> Cursor CLI (varsayilan; Cursor uyelik havuzu, API faturasi yok)
 *   saglayici: 'mock'          -> offline fixture (test / --dry-run)
 *   saglayici: 'openai'        -> OpenAI ve OpenAI-uyumlu (OpenRouter, Groq, DeepSeek, LM Studio)
 *   saglayici: 'anthropic'     -> Anthropic Messages API
 *
 * Butce: API saglayicilarinda dolar, Cursor CLI'de cagri adedi tavani. Tavan asilirsa
 * ButceHatasi. Bu, "gece calisan ajan kotayi bitirdi" senaryosunu engelleyen sert kapidir.
 */
import { mockYanit } from './mock-provider.mjs';
import { cursorCagir, komutBul, modBul } from './cursor-cli.mjs';

export class ButceHatasi extends Error {
  constructor(mesaj) {
    super(mesaj);
    this.name = 'ButceHatasi';
  }
}

const VARSAYILAN_BASE = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1'
};

function apiKey(saglayici) {
  return (
    process.env.MONEY_LLM_API_KEY ||
    (saglayici === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY) ||
    ''
  );
}

/** Model ciktisindan JSON cikarir: kod citi, on/arka gevezelik toleransli. */
export function jsonCikar(metin) {
  if (typeof metin !== 'string') throw new Error('JSON bekleniyordu, metin yok');
  let s = metin.trim();
  const cit = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (cit) s = cit[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    /* asagida kaba tarama */
  }
  const ilk = Math.min(...['{', '['].map((c) => (s.indexOf(c) === -1 ? Infinity : s.indexOf(c))));
  const son = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (!Number.isFinite(ilk) || son <= ilk) throw new Error('cevapta JSON bulunamadi');
  return JSON.parse(s.slice(ilk, son + 1));
}

function fiyat(cfg, model) {
  return cfg.llm.fiyatlar?.[model] || cfg.llm.fiyatlar?.varsayilan || { girdiUSDperMTok: 0, ciktiUSDperMTok: 0 };
}

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

export function createLLM(cfg, { log = () => {} } = {}) {
  const saglayici = cfg.llm.saglayici;
  const kullanim = { cagri: 0, girdiTok: 0, ciktiTok: 0, usd: 0, hata: 0, kayitlar: [] };

  const cursorAyar = cfg.llm.cursor || {};
  const cursorKomut = saglayici === 'cursor' ? komutBul(cursorAyar) : null;
  const cursorMod = saglayici === 'cursor' ? modBul(cursorAyar) : null;

  async function hamCagri({ model, system, user, temperature, maxTokens }) {
    if (saglayici === 'mock') return mockYanit({ system, user, model });

    if (saglayici === 'cursor') {
      // CLI'de system rolu yok: tek prompt olarak birlestirilir.
      // Panelde "takildi mi?" belirsizligini azaltmak icin bekleme satiri.
      log(`  … cursor-cli bekleniyor (${model})`);
      return cursorCagir({
        komut: cursorKomut,
        mod: cursorMod,
        model,
        prompt: `${system}\n\n---\n\n${user}`,
        ekBayraklar: cursorAyar.ekBayraklar || ['--trust', '-f'],
        timeoutMs: cursorAyar.timeoutMs || 300000
      });
    }

    const anahtar = apiKey(saglayici);
    if (!anahtar) throw new Error(`API anahtari yok (${saglayici}). OPENAI_API_KEY / ANTHROPIC_API_KEY / MONEY_LLM_API_KEY`);
    const base = cfg.llm.baseUrl || VARSAYILAN_BASE[saglayici] || VARSAYILAN_BASE.openai;

    if (saglayici === 'anthropic') {
      const r = await fetch(`${base}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': anahtar, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, system, max_tokens: maxTokens, temperature, messages: [{ role: 'user', content: user }] })
      });
      if (!r.ok) throw Object.assign(new Error(`anthropic ${r.status}: ${await r.text()}`), { status: r.status });
      const j = await r.json();
      return {
        metin: (j.content || []).map((c) => c.text || '').join('\n'),
        girdiTok: j.usage?.input_tokens || 0,
        ciktiTok: j.usage?.output_tokens || 0
      };
    }

    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${anahtar}` },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });
    if (!r.ok) throw Object.assign(new Error(`openai ${r.status}: ${await r.text()}`), { status: r.status });
    const j = await r.json();
    return {
      metin: j.choices?.[0]?.message?.content || '',
      girdiTok: j.usage?.prompt_tokens || 0,
      ciktiTok: j.usage?.completion_tokens || 0
    };
  }

  /** JSON dondurmesi zorunlu cagri. Deneme: 3 (429/5xx/parse hatasi). */
  async function json({ etiket, system, user, model, temperature, maxTokens, dogrula }) {
    const m = model || cfg.llm.model;
    const t = temperature ?? cfg.llm.temperature;
    const mt = maxTokens ?? cfg.llm.maxTokens;

    if (saglayici === 'cursor') {
      if (kullanim.cagri >= cfg.akis.runCagriTavani) {
        throw new ButceHatasi(`cagri tavani doldu: ${kullanim.cagri} / ${cfg.akis.runCagriTavani}`);
      }
    } else if (kullanim.usd >= cfg.akis.runButceUSD) {
      throw new ButceHatasi(`butce doldu: $${kullanim.usd.toFixed(4)} / $${cfg.akis.runButceUSD}`);
    }

    let sonHata;
    for (let deneme = 1; deneme <= 3; deneme++) {
      try {
        const y = await hamCagri({ model: m, system, user, temperature: t, maxTokens: mt });
        // Cursor havuzu: dolar faturasi yok, maliyet uyelik kotasindan duser.
        const f = saglayici === 'cursor' ? { girdiUSDperMTok: 0, ciktiUSDperMTok: 0 } : fiyat(cfg, m);
        const usd = (y.girdiTok / 1e6) * f.girdiUSDperMTok + (y.ciktiTok / 1e6) * f.ciktiUSDperMTok;
        kullanim.cagri++;
        kullanim.girdiTok += y.girdiTok;
        kullanim.ciktiTok += y.ciktiTok;
        kullanim.usd += usd;
        kullanim.kayitlar.push({ etiket, model: m, girdiTok: y.girdiTok, ciktiTok: y.ciktiTok, usd });

        const veri = jsonCikar(y.metin);
        if (dogrula) {
          const hata = dogrula(veri);
          if (hata) throw new Error(`sema hatasi: ${hata}`);
        }
        return veri;
      } catch (e) {
        sonHata = e;
        if (e instanceof ButceHatasi || e.kalici) throw e;
        kullanim.hata++;
        log(`  ! ${etiket} deneme ${deneme}/3 basarisiz: ${String(e.message).slice(0, 160)}`);
        if (deneme < 3) await bekle(800 * 2 ** (deneme - 1));
      }
    }
    throw sonHata;
  }

  return { json, kullanim, saglayici };
}
