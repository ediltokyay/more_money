const $ = (id) => document.getElementById(id);

const el = {
  baglanti: $('baglanti'),
  events: $('events'),
  runCard: $('run-card'),
  reportList: $('report-list'),
  reportTitle: $('report-title'),
  reportBody: $('report-body'),
  btnIndir: $('btn-indir'),
  btnKopyala: $('btn-kopyala'),
  btnKuru: $('btn-kuru'),
  btnGercek: $('btn-gercek'),
  btnTemizle: $('btn-temizle'),
  btnYenile: $('btn-yenile'),
  forceNew: $('force-new'),
  ledgerBody: $('ledger-body')
};

let seciliRapor = null;
let ledgerMod = 'gercek';
let calisiyor = false;

function saat(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function baglantiDurum(state, metin) {
  el.baglanti.dataset.state = state;
  el.baglanti.textContent = metin;
}

function setCalisiyor(v) {
  calisiyor = v;
  el.btnKuru.disabled = v;
  el.btnGercek.disabled = v;
  baglantiDurum(v ? 'calisiyor' : 'bagli', v ? 'tur çalışıyor' : 'bağlı');
}

function olayEkle(o, { replay = false } = {}) {
  if (!o || o.tip === 'hello') {
    if (o?.durum) guncelleRunCard(o.durum);
    if (!replay) el.events.innerHTML = '';
    return;
  }
  const li = document.createElement('li');
  li.className = o.seviye || o.tip || '';
  li.innerHTML = `<span class="time">${saat(o.t)}</span><span class="tip">${o.tip || 'log'}</span><span class="metin"></span>`;
  li.querySelector('.metin').textContent = o.metin || '';
  el.events.appendChild(li);
  el.events.scrollTop = el.events.scrollHeight;

  if (o.tip === 'bitti' || o.tip === 'hata') {
    setCalisiyor(false);
    raporlariYukle();
    defteriYukle();
    if (o.raporAdi) raporAc(o.raporAdi);
  }
  if (o.tip === 'durum') setCalisiyor(true);
}

function guncelleRunCard(durum) {
  const r = durum?.run;
  if (!r) {
    el.runCard.innerHTML = '<div class="muted">Henüz tur yok</div>';
    return;
  }
  const satirlar = [
    `<strong>${r.kuru ? 'Kuru' : 'Gerçek'} tur</strong>`,
    `<div>${durum.calisiyor ? 'çalışıyor…' : r.hata ? 'hata' : 'bitti'}</div>`
  ];
  if (r.ozet) {
    satirlar.push(
      `<div class="muted" style="margin-top:0.4rem">fikir ${r.ozet.fikir} · araştırılan ${r.ozet.arastirilan} · çağrı ${r.ozet.cagri}</div>`
    );
    if (r.ozet.kazanan) satirlar.push(`<div>kazanan: ${r.ozet.kazanan}</div>`);
  }
  if (r.raporAdi) satirlar.push(`<div style="margin-top:0.4rem">rapor: ${r.raporAdi}</div>`);
  if (r.hata) satirlar.push(`<div style="color:var(--danger);margin-top:0.4rem">${r.hata}</div>`);
  el.runCard.innerHTML = satirlar.join('');
}

async function turBaslat(gercek) {
  if (calisiyor) return;
  if (gercek) {
    const ok = confirm(
      'Gerçek tur Cursor CLI / API kotası kullanır.\nDevam edilsin mi?'
    );
    if (!ok) return;
  }
  setCalisiyor(true);
  el.events.innerHTML = '';
  try {
    const r = await fetch('/api/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kuru: !gercek, forceNew: el.forceNew.checked })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.hata || 'tur baslatilamadi');
    guncelleRunCard(j);
  } catch (e) {
    setCalisiyor(false);
    olayEkle({ t: Date.now(), tip: 'hata', seviye: 'hata', metin: `HATA: ${e.message}` });
  }
}

async function raporlariYukle() {
  const r = await fetch('/api/reports');
  const j = await r.json();
  el.reportList.innerHTML = '';
  if (!j.raporlar?.length) {
    el.reportList.innerHTML = '<li class="muted">Rapor yok</li>';
    return;
  }
  for (const rap of j.raporlar) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.ad = rap.ad;
    if (rap.ad === seciliRapor) btn.classList.add('active');
    btn.innerHTML = `<span>${rap.ad}</span><span class="meta">${new Date(rap.guncelleme).toLocaleString('tr-TR')} · ${Math.round(rap.bayt / 1024)} KB${rap.kuru ? ' · kuru' : ''}</span>`;
    btn.addEventListener('click', () => raporAc(rap.ad));
    li.appendChild(btn);
    el.reportList.appendChild(li);
  }
}

async function raporAc(ad) {
  seciliRapor = ad;
  for (const btn of el.reportList.querySelectorAll('button')) {
    btn.classList.toggle('active', btn.dataset.ad === ad);
  }
  el.reportTitle.textContent = ad;
  el.btnIndir.href = `/api/reports/${encodeURIComponent(ad)}/download`;
  el.btnIndir.setAttribute('download', ad);
  el.btnIndir.removeAttribute('aria-disabled');
  el.btnKopyala.disabled = false;
  const r = await fetch(`/api/reports/${encodeURIComponent(ad)}`);
  el.reportBody.textContent = await r.text();
}

async function defteriYukle() {
  const r = await fetch(`/api/ledger${ledgerMod === 'kuru' ? '?kuru=1' : ''}`);
  const j = await r.json();
  const fikirler = (j.fikirler || []).slice().sort((a, b) => (b.skor || 0) - (a.skor || 0));
  if (!fikirler.length) {
    el.ledgerBody.innerHTML = '<tr><td colspan="3" class="muted">Defter boş</td></tr>';
    return;
  }
  el.ledgerBody.innerHTML = fikirler
    .map(
      (f) => `<tr>
      <td>${f.skor ?? '-'}</td>
      <td><span class="badge ${f.durum || ''}">${f.durum || '-'}</span></td>
      <td><div>${escapeHtml(f.baslik || '')}</div><div class="muted">${escapeHtml(f.tekCumle || '')}</div></td>
    </tr>`
    )
    .join('');
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sseBaglan() {
  const es = new EventSource('/api/events');
  es.onopen = () => baglantiDurum(calisiyor ? 'calisiyor' : 'bagli', calisiyor ? 'tur çalışıyor' : 'bağlı');
  es.onmessage = (ev) => {
    try {
      const o = JSON.parse(ev.data);
      if (o.tip === 'hello' && o.durum) {
        setCalisiyor(Boolean(o.durum.calisiyor));
        guncelleRunCard(o.durum);
      }
      olayEkle(o);
    } catch {
      /* yoksay */
    }
  };
  es.onerror = () => {
    baglantiDurum('kopuk', 'bağlantı koptu — yeniden…');
  };
}

el.btnKuru.addEventListener('click', () => turBaslat(false));
el.btnGercek.addEventListener('click', () => turBaslat(true));
el.btnTemizle.addEventListener('click', () => {
  el.events.innerHTML = '';
});
el.btnYenile.addEventListener('click', () => {
  raporlariYukle();
  defteriYukle();
});
el.btnKopyala.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(el.reportBody.textContent || '');
    el.btnKopyala.textContent = 'Kopyalandı';
    setTimeout(() => {
      el.btnKopyala.textContent = 'Kopyala';
    }, 1200);
  } catch {
    el.btnKopyala.textContent = 'Kopyalanamadı';
  }
});

for (const btn of document.querySelectorAll('.seg-btn')) {
  btn.addEventListener('click', () => {
    for (const b of document.querySelectorAll('.seg-btn')) b.classList.remove('active');
    btn.classList.add('active');
    ledgerMod = btn.dataset.ledger;
    defteriYukle();
  });
}

sseBaglan();
raporlariYukle();
defteriYukle();
fetch('/api/status')
  .then((r) => r.json())
  .then((d) => {
    setCalisiyor(Boolean(d.calisiyor));
    guncelleRunCard(d);
  })
  .catch(() => {});
