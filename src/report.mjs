/**
 * Markdown rapor uretimi.
 *
 * Rapor kurali: en ustte TEK is olur. Liste okumak karar degildir; sistemin cikti sozlesmesi
 * "bu hafta sunu yap" cumlesidir. Geri kalan her sey ekte.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPORT_DIR } from './config.mjs';
import { OLCULER } from './score.mjs';

const usd = (v) => (Number.isFinite(Number(v)) ? `$${Math.round(Number(v))}` : '-');
const gun = (v) => (Number.isFinite(Number(v)) ? `${Math.round(Number(v))} gun` : '-');

function altSkorSatiri(p) {
  return OLCULER.map((o) => `${o} ${p.altSkorlar?.[o] ?? 0}/5`).join(' · ');
}

function fikirDetayi(d, sira) {
  const { fikir, dosya, denetim, puan, linkRaporu } = d;
  const s = [];
  s.push(`### ${sira}. ${fikir.baslik} — **${puan.skor}/100** (${puan.durum})`);
  s.push('');
  s.push(`${fikir.tekCumle}`);
  s.push('');
  s.push(`- **Neden yapilabilir:** ${fikir.nedenUygun || '-'}`);
  s.push(`- **Musteri:** ${fikir.musteri || '-'} | **Gelir modeli:** ${fikir.gelirModeli || '-'}`);
  s.push(
    `- **12. ay net (denetlenmis):** ${usd(denetim?.duzeltilmisNetAy12USD ?? dosya?.netAy12USD)} | **Ilk para:** ${gun(
      denetim?.duzeltilmisIlkParaGun ?? dosya?.gerceklesme?.ilkParaGun
    )} | **Kurulum:** ${usd(dosya?.kurulumUSD ?? fikir.kurulumUSD)} | **Aylik gider:** ${usd(dosya?.birimEkonomi?.aylikSabitUSD)}`
  );
  s.push(`- **Alt olculer:** ${altSkorSatiri(puan)} (ham ${puan.temelSkor})`);
  if (puan.cezalar.length) {
    s.push(`- **Cezalar:** ${puan.cezalar.map((c) => `${c.ad} -${c.puan} (${c.neden})`).join('; ')}`);
  }
  s.push('');
  s.push('**Ilk uc adim**');
  for (const a of dosya?.ilkUcAdim || []) s.push(`1. [${a.kimYapar || '?'}] ${a.adim} — ${a.sure || '?'}`);
  s.push('');
  s.push(`**Olum kriteri:** ${dosya?.olumKriteri || '-'}`);
  if (dosya?.otonomi) {
    s.push(
      `**Otonomi:** ajan yapar: ${(dosya.otonomi.ajanYapabilir || []).join(', ') || '-'} | insan sart: ${
        (dosya.otonomi.insanSart || []).join(', ') || '-'
      } | gunluk mudahale: ${dosya.otonomi.gunlukMudahaleGerekiyor ? 'EVET' : 'hayir'}`
    );
  }
  if (denetim?.kirmiziBayraklar?.length) {
    s.push('');
    s.push('**Denetci kirmizi bayraklari**');
    for (const k of denetim.kirmiziBayraklar) s.push(`- ${k}`);
  }
  if (denetim?.kanitsizIddialar?.length) {
    s.push('');
    s.push(`**Kanitsiz iddialar:** ${denetim.kanitsizIddialar.join(' · ')}`);
  }
  if (linkRaporu?.kontrolEdildi) {
    s.push('');
    s.push(`**Kanit linkleri:** ${linkRaporu.calisan}/${linkRaporu.toplam} acildi`);
    for (const l of linkRaporu.detay || []) s.push(`- ${l.ok ? 'OK' : 'OLU'} ${l.kod || ''} ${l.url}${l.not ? ` (${l.not})` : ''}`);
  }
  if (denetim?.ozet) {
    s.push('');
    s.push(`> ${denetim.ozet}`);
  }
  return s.join('\n');
}

export function raporUret(cfg, sonuc) {
  const { runId, kapi, degerlendirmeler, elenenler, kazanan, kullanim, uyarilar, saglayici } = sonuc;
  const gosterilecek = degerlendirmeler.slice(0, cfg.akis.raporaGirenMax);
  const s = [];

  s.push(`# Para raporu — ${new Date().toISOString().slice(0, 10)} (run ${runId})`);
  s.push('');
  // Cursor havuzunda dolar faturasi yok; olculen sey cagri adedi.
  const maliyet =
    saglayici === 'cursor'
      ? `cagri: ${kullanim.cagri}/${cfg.akis.runCagriTavani} (Cursor havuzu · arastirma \`${cfg.llm.model}\` · denetim \`${cfg.llm.denetciModel}\`)`
      : `maliyet: $${(kullanim.usd || 0).toFixed(4)}`;
  s.push(
    `saglayici: \`${saglayici}\` · uretilen: ${sonuc.ham.length} · arastirilan: ${degerlendirmeler.length} · ${maliyet} · sure: ${sonuc.saniye}s`
  );
  if (saglayici === 'mock') {
    s.push('');
    s.push('> **KURU CALISMA.** Bu rapor fixture verisiyle uretildi, gercek pazar arastirmasi degildir.');
  }
  s.push('');
  s.push('## Bu haftanin tek isi');
  s.push('');
  if (kapi.kilit) {
    s.push(`**Yeni is yok. Once bunu bitir:** ${kapi.acik.map((a) => `\`${a.baslik}\``).join(', ')}`);
    s.push('');
    s.push(
      `Acik pilot ${kapi.acik.length}/${kapi.limit}. Kural: ayni anda tek acik is. Bitir, oldur ya da \`--force-new\` ile bu kapiyi bilerek ac.`
    );
    for (const a of kapi.acik) {
      s.push('');
      s.push(`- **${a.baslik}** — olum kriteri: ${a.olumKriteri || 'tanimsiz'} (pilot basligi: ${a.guncellendi?.slice(0, 10)})`);
    }
  } else if (kazanan) {
    s.push(`**${kazanan.fikir.baslik}** — ${kazanan.puan.skor}/100`);
    s.push('');
    s.push(`${kazanan.fikir.tekCumle}`);
    s.push('');
    s.push('Ilk hamle:');
    for (const a of (kazanan.dosya?.ilkUcAdim || []).slice(0, 3)) s.push(`1. [${a.kimYapar}] ${a.adim} (${a.sure})`);
    s.push('');
    s.push(`Olum kriteri: **${kazanan.dosya?.olumKriteri || 'tanimsiz'}**`);
    s.push('');
    s.push(
      `Kabul edersen defterde durumu \`pilot\` yap: \`node run.mjs --pilot ${
        sonuc.defter.fikirler.find((f) => f.baslik === kazanan.fikir.baslik)?.id || ''
      }\``
    );
  } else if (!degerlendirmeler.length && uyarilar.length) {
    s.push('**Tur tamamlanamadi.** Hicbir fikir degerlendirilemedi; asagidaki uyarilara bak.');
    s.push('');
    for (const u of uyarilar) s.push(`- ${u}`);
  } else {
    s.push('**Onay esigini gecen fikir yok.** Bu bir basarisizlik degil; esik dusurmeden bir sonraki run beklenir.');
    s.push('');
    s.push(`En yuksek: ${degerlendirmeler[0] ? `${degerlendirmeler[0].fikir.baslik} (${degerlendirmeler[0].puan.skor})` : '-'}`);
  }

  if (degerlendirmeler.length) {
    s.push('');
    s.push('## Siralama');
    s.push('');
    s.push('| # | Fikir | Skor | Durum | Ilk para | 12. ay net | Otonomi |');
    s.push('|---|-------|------|-------|----------|------------|---------|');
    degerlendirmeler.forEach((d, i) => {
      s.push(
        `| ${i + 1} | ${d.fikir.baslik} | ${d.puan.skor} | ${d.puan.durum} | ${gun(
          d.denetim?.duzeltilmisIlkParaGun ?? d.dosya?.gerceklesme?.ilkParaGun
        )} | ${usd(d.denetim?.duzeltilmisNetAy12USD ?? d.dosya?.netAy12USD)} | ${d.puan.altSkorlar?.otonomi ?? 0}/5 |`
      );
    });
  }

  if (gosterilecek.length) {
    s.push('');
    s.push('## Detaylar');
    s.push('');
    gosterilecek.forEach((d, i) => {
      s.push(fikirDetayi(d, i + 1));
      s.push('');
    });
  }

  const redler = degerlendirmeler.filter((d) => d.puan.durum === 'red');
  if (redler.length || elenenler.length) {
    s.push('## Elenenler');
    s.push('');
    for (const r of redler) s.push(`- **${r.fikir.baslik}** — ${r.puan.redSebebi || 'denetci reddi'}`);
    for (const e of elenenler) s.push(`- ${e.fikir.baslik} — ${e.sebep}`);
    s.push('');
  }

  s.push('## Defter');
  s.push('');
  const say = (d) => sonuc.defter.fikirler.filter((f) => f.durum === d).length;
  s.push(
    `toplam ${sonuc.defter.fikirler.length} fikir · onayli ${say('onayli')} · izlemede ${say('izlemede')} · pilot ${say(
      'pilot'
    )} · canli ${say('canli')} · elendi ${say('elendi')} · red ${say('red')} · olduruldu ${say('olduruldu')}`
  );

  if (uyarilar.length) {
    s.push('');
    s.push('## Uyarilar');
    s.push('');
    for (const u of uyarilar) s.push(`- ${u}`);
  }

  s.push('');
  return s.join('\n');
}

export function raporYaz(cfg, sonuc, yol) {
  const hedef = yol || cfg.calisma.ciktiYolu || path.join(REPORT_DIR, `${cfg.calisma.raporOnEk || ''}${sonuc.runId}.md`);
  fs.mkdirSync(path.dirname(hedef), { recursive: true });
  fs.writeFileSync(hedef, raporUret(cfg, sonuc), 'utf8');
  return hedef;
}
