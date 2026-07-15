/* ══════════════════════════════════════════════════════════════════
   Sahabat Muslim — jadwal sholat, Al-Qur'an (Kemenag), arah kiblat
   Semua logika berjalan lokal di perangkat; data surah di-cache
   oleh service worker sehingga bisa dibaca offline.
   ══════════════════════════════════════════════════════════════════ */
'use strict';

const $ = (sel) => document.querySelector(sel);
const KAABA = { lat: 21.4225, lng: 39.8262 };
const DEFAULT_LOC = { lat: -6.2, lng: 106.8167, nama: 'Jakarta (bawaan)' };

/* ────────────────────────────────────────────────
   Util trigonometri derajat
   ──────────────────────────────────────────────── */
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const dsin = (d) => Math.sin(rad(d));
const dcos = (d) => Math.cos(rad(d));
const dtan = (d) => Math.tan(rad(d));
const darcsin = (x) => deg(Math.asin(x));
const darccos = (x) => deg(Math.acos(Math.min(1, Math.max(-1, x))));
const darctan2 = (y, x) => deg(Math.atan2(y, x));
const fixAngle = (a) => ((a % 360) + 360) % 360;
const fixHour = (h) => ((h % 24) + 24) % 24;

/* ────────────────────────────────────────────────
   Perhitungan waktu sholat (Ashar mazhab Syafi'i)
   Metode: sudut Subuh/Isya + ihtiyat berbeda
   ──────────────────────────────────────────────── */
const METODE = {
  kemenag: { nama: 'Kemenag RI', subuh: 20, isya: 18, ihtiyat: 2 },
  mwl: { nama: 'Muslim World League', subuh: 18, isya: 17, ihtiyat: 0 },
};
let metodeAktif = localStorage.getItem('sm_metode') || 'kemenag';
if (!METODE[metodeAktif]) metodeAktif = 'kemenag';
function julianDate(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = fixHour(darctan2(dcos(e) * dsin(L), dcos(L)) / 15);
  const eqt = q / 15 - RA; // equation of time (jam)
  const decl = darcsin(dsin(e) * dsin(L));
  return { decl, eqt: eqt > 12 ? eqt - 24 : eqt < -12 ? eqt + 24 : eqt };
}

// selisih jam dari tengah hari untuk ketinggian matahari -angle di bawah ufuk
function hourAngle(angle, lat, decl) {
  const cosH = (-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat));
  return darccos(cosH) / 15;
}

function hitungJadwal(date, lat, lng) {
  const met = METODE[metodeAktif];
  const tz = -date.getTimezoneOffset() / 60;
  const jd = julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  // perkirakan posisi matahari saat tengah hari lokal
  let { decl, eqt } = sunPosition(jd + 0.5 - tz / 24);
  const dzuhurUTCless = 12 - eqt; // jam matahari lokal
  const toLocal = (h) => h + tz - lng / 15;

  const dzuhur = toLocal(dzuhurUTCless);
  const subuh = toLocal(dzuhurUTCless - hourAngle(met.subuh, lat, decl));
  const terbit = toLocal(dzuhurUTCless - hourAngle(0.833, lat, decl));
  const maghrib = toLocal(dzuhurUTCless + hourAngle(0.833, lat, decl));
  const isya = toLocal(dzuhurUTCless + hourAngle(met.isya, lat, decl));
  // Ashar Syafi'i: bayangan = panjang benda + bayang saat dzuhur
  const asrAlt = -deg(Math.atan(1 / (1 + dtan(Math.abs(lat - decl)))));
  const ashar = toLocal(dzuhurUTCless + hourAngle(asrAlt, lat, decl));

  // ihtiyat (Kemenag: +2 menit, terbit −2 menit); imsak = subuh − 10 menit
  const m = met.ihtiyat / 60;
  return {
    imsak: subuh + m - 10 / 60,
    subuh: subuh + m,
    terbit: terbit - m,
    dzuhur: dzuhur + m,
    ashar: ashar + m,
    maghrib: maghrib + m,
    isya: isya + m,
  };
}

const jamStr = (h) => {
  if (!isFinite(h)) return '--:--';
  h = fixHour(h);
  const jam = Math.floor(h);
  const mnt = Math.round((h - jam) * 60);
  const j2 = mnt === 60 ? jam + 1 : jam;
  const m2 = mnt === 60 ? 0 : mnt;
  return `${String(j2 % 24).padStart(2, '0')}:${String(m2).padStart(2, '0')}`;
};

/* ────────────────────────────────────────────────
   Lokasi
   ──────────────────────────────────────────────── */
const state = {
  loc: JSON.parse(localStorage.getItem('sm_loc') || 'null') || { ...DEFAULT_LOC, cached: false },
  jadwal: null,
  surahIndex: [],
  surahAktif: null,
};

function simpanLokasi() {
  localStorage.setItem('sm_loc', JSON.stringify(state.loc));
}

function mintaLokasi(interaktif) {
  if (!('geolocation' in navigator)) {
    $('#nama-lokasi').textContent = state.loc.nama;
    return;
  }
  $('#nama-lokasi').textContent = 'Mencari lokasi…';
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      state.loc = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        nama: `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`,
      };
      simpanLokasi();
      renderSemua();
      // nama kota (butuh internet; abaikan bila gagal)
      try {
        const r = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${state.loc.lat}&longitude=${state.loc.lng}&localityLanguage=id`
        );
        const d = await r.json();
        const nama = d.city || d.locality || d.principalSubdivision;
        if (nama) {
          state.loc.nama = nama;
          simpanLokasi();
          renderSemua();
        }
      } catch (_) { /* offline: biarkan koordinat */ }
    },
    () => {
      if (interaktif) alert('Izin lokasi ditolak. Aktifkan di Pengaturan ▸ Privasi ▸ Layanan Lokasi, lalu coba lagi. Sementara memakai lokasi tersimpan/bawaan.');
      $('#nama-lokasi').textContent = state.loc.nama;
      renderSemua();
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
  );
}

/* ────────────────────────────────────────────────
   Render tab Sholat
   ──────────────────────────────────────────────── */
const URUTAN = [
  ['imsak', 'Imsak', '🌌'],
  ['subuh', 'Subuh', '🌅'],
  ['terbit', 'Terbit', '☀️'],
  ['dzuhur', 'Dzuhur', '🌞'],
  ['ashar', 'Ashar', '🌤'],
  ['maghrib', 'Maghrib', '🌇'],
  ['isya', 'Isya', '🌙'],
];
const SHOLAT5 = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
const NAMA = { subuh: 'Subuh', dzuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: 'Isya' };

function renderSholat() {
  const now = new Date();
  state.jadwal = hitungJadwal(now, state.loc.lat, state.loc.lng);

  $('#tanggal-masehi').textContent = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  try {
    const hijriah = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(now);
    $('#tanggal-hijriah').textContent = /H\.?$/.test(hijriah.trim()) ? hijriah : hijriah + ' H';
  } catch (_) { /* kalender islam tidak didukung */ }

  $('#nama-lokasi').textContent = state.loc.nama;

  const jamKini = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

  // sholat berikutnya (di antara 5 waktu)
  let next = null;
  for (const k of SHOLAT5) {
    if (state.jadwal[k] > jamKini) { next = k; break; }
  }
  const besok = !next;
  if (besok) next = 'subuh';
  const jadwalNext = besok
    ? hitungJadwal(new Date(now.getTime() + 86400000), state.loc.lat, state.loc.lng)
    : state.jadwal;
  $('#next-name').textContent = NAMA[next] + (besok ? ' (besok)' : '');
  $('#next-time').textContent = jamStr(jadwalNext[next]);

  const targetJam = besok ? jadwalNext[next] + 24 : jadwalNext[next];
  const sisa = (targetJam - jamKini) * 3600;
  const j = Math.floor(sisa / 3600), mn = Math.floor((sisa % 3600) / 60), dt = Math.floor(sisa % 60);
  $('#countdown').textContent = `− ${String(j).padStart(2, '0')}:${String(mn).padStart(2, '0')}:${String(dt).padStart(2, '0')}`;

  // waktu aktif = sholat yang sedang berlangsung
  let aktif = null;
  for (let i = SHOLAT5.length - 1; i >= 0; i--) {
    if (jamKini >= state.jadwal[SHOLAT5[i]]) { aktif = SHOLAT5[i]; break; }
  }

  const wrap = $('#daftar-waktu');
  wrap.innerHTML = '';
  for (const [k, label, ikon] of URUTAN) {
    const row = document.createElement('div');
    row.className = 'waktu-row';
    if (k === aktif) row.classList.add('aktif');
    else if (state.jadwal[k] < jamKini && SHOLAT5.includes(k)) row.classList.add('lewat');
    row.innerHTML = `<div class="waktu-nama"><span class="waktu-ikon">${ikon}</span>${label}</div>
      <div class="waktu-jam">${jamStr(state.jadwal[k])}</div>`;
    wrap.appendChild(row);
  }

  const met = METODE[metodeAktif];
  $('#catatan-metode').textContent =
    `Perhitungan metode ${met.nama} (Subuh ${met.subuh}°, Isya ${met.isya}°` +
    `${met.ihtiyat ? ', + ihtiyat' : ''}) berdasarkan koordinat GPS perangkat.`;
  document.querySelectorAll('#pilih-metode .segbtn').forEach((b) =>
    b.classList.toggle('active', b.dataset.metode === metodeAktif));
}

/* ────────────────────────────────────────────────
   Al-Qur'an
   ──────────────────────────────────────────────── */
async function muatIndexSurah() {
  try {
    const r = await fetch('data/surah-index.json');
    state.surahIndex = await r.json();
    renderDaftarSurah('');
  } catch (e) {
    $('#daftar-surah').innerHTML = '<p class="subtle">Gagal memuat daftar surah.</p>';
  }
}

function renderDaftarSurah(q) {
  const wrap = $('#daftar-surah');
  wrap.innerHTML = '';
  const qq = q.trim().toLowerCase();
  const cocok = state.surahIndex.filter((s) =>
    !qq ||
    s.namaLatin.toLowerCase().includes(qq) ||
    s.arti.toLowerCase().includes(qq) ||
    String(s.nomor) === qq
  );
  for (const s of cocok) {
    const b = document.createElement('button');
    b.className = 'surah-item';
    b.innerHTML = `<span class="surah-no">${s.nomor}</span>
      <span class="surah-mid">
        <span class="surah-latin">${s.namaLatin}</span>
        <span class="surah-arti">${s.arti} • ${s.jumlahAyat} ayat • ${s.tempatTurun}</span>
      </span>
      <span class="surah-ar">${s.nama}</span>`;
    b.addEventListener('click', () => bukaSurah(s.nomor));
    wrap.appendChild(b);
  }
}

function getBookmark() {
  return JSON.parse(localStorage.getItem('sm_bookmark') || 'null');
}

/* bookmark banyak ayat */
function getBookmarks() {
  return JSON.parse(localStorage.getItem('sm_bookmarks') || '[]');
}
function isBookmarked(surah, ayat) {
  return getBookmarks().some((b) => b.s === surah && b.a === ayat);
}
function toggleBookmarkAyat(surahData, a) {
  const list = getBookmarks();
  const i = list.findIndex((b) => b.s === surahData.nomor && b.a === a.n);
  if (i >= 0) list.splice(i, 1);
  else list.unshift({
    s: surahData.nomor, a: a.n, nama: surahData.namaLatin,
    cuplikan: a.id.length > 90 ? a.id.slice(0, 90) + '…' : a.id,
  });
  localStorage.setItem('sm_bookmarks', JSON.stringify(list));
}

function renderTabSimpan() {
  const list = getBookmarks();
  const wrap = $('#daftar-simpan');
  $('#simpan-kosong').classList.toggle('hidden', list.length > 0);
  wrap.innerHTML = '';
  for (const b of list) {
    const row = document.createElement('div');
    row.className = 'bm-item';
    row.innerHTML = `
      <button class="bm-main">
        <span class="bm-judul">${b.nama} : ${b.a}</span>
        <span class="bm-cuplikan">${b.cuplikan}</span>
      </button>
      <button class="bm-hapus" aria-label="Hapus bookmark">✕</button>`;
    row.querySelector('.bm-main').addEventListener('click', () => {
      pindahTab('tab-quran');
      bukaSurah(b.s, b.a);
    });
    row.querySelector('.bm-hapus').addEventListener('click', () => {
      const sisa = getBookmarks().filter((x) => !(x.s === b.s && x.a === b.a));
      localStorage.setItem('sm_bookmarks', JSON.stringify(sisa));
      renderTabSimpan();
    });
    wrap.appendChild(row);
  }
}

function renderResume() {
  const bm = getBookmark();
  const btn = $('#btn-lanjut');
  if (!bm || !state.surahIndex.length) { btn.classList.add('hidden'); return; }
  const s = state.surahIndex[bm.surah - 1];
  btn.innerHTML = `📖 Lanjutkan membaca<small>${s.namaLatin} : ayat ${bm.ayat}</small>`;
  btn.classList.remove('hidden');
  btn.onclick = () => bukaSurah(bm.surah, bm.ayat);
}

async function bukaSurah(no, gulirKeAyat) {
  let data;
  try {
    const r = await fetch(`data/surah/${no}.json`);
    data = await r.json();
  } catch (e) {
    alert('Surah belum ter-cache dan tidak ada koneksi. Buka sekali saat online agar tersimpan.');
    return;
  }
  state.surahAktif = data;
  localStorage.setItem('sm_lastsurah', String(no));
  // "terakhir dibaca" otomatis: mulai dari ayat yang dituju/awal surah,
  // lalu diperbarui mengikuti scroll (lihat simpanPosisiBaca)
  localStorage.setItem('sm_bookmark', JSON.stringify({ surah: no, ayat: gulirKeAyat || 1 }));

  $('#quran-list-view').classList.add('hidden');
  $('#quran-reader-view').classList.remove('hidden');
  $('#reader-nama').textContent = `${data.nomor}. ${data.namaLatin} (${data.nama})`;
  $('#reader-info').textContent = `${data.arti} • ${data.jumlahAyat} ayat • ${data.tempatTurun}`;
  $('#basmalah').classList.toggle('hidden', no === 1 || no === 9);
  $('#btn-prev-surah').disabled = no <= 1;
  $('#btn-next-surah').disabled = no >= 114;

  renderAyat();

  if (gulirKeAyat) {
    // setTimeout (bukan rAF): tetap berjalan meski tab/halaman di-throttle
    setTimeout(() => {
      const el = document.getElementById(`ayat-${gulirKeAyat}`);
      if (el) el.scrollIntoView({ block: 'center' });
    }, 80);
  } else {
    window.scrollTo(0, 0);
  }
}

function renderAyat() {
  const data = state.surahAktif;
  if (!data) return;
  const showLatin = $('#opt-latin').checked;
  const showId = $('#opt-terjemah').checked;
  const wrap = $('#daftar-ayat');
  wrap.innerHTML = '';
  for (const a of data.ayat) {
    const card = document.createElement('div');
    card.className = 'ayat-card';
    card.id = `ayat-${a.n}`;
    const difavorit = isBookmarked(data.nomor, a.n);
    card.innerHTML = `
      <div class="ayat-topbar">
        <span class="ayat-no">${data.namaLatin} : ${a.n}</span>
        <button class="btn-star${difavorit ? ' aktif' : ''}" title="Bookmark ayat">${difavorit ? '★' : '☆'}</button>
      </div>
      <div class="ayat-arab">${a.ar}</div>
      ${showLatin ? `<div class="ayat-latin">${a.lt}</div>` : ''}
      ${showId ? `<div class="ayat-id">${a.id}</div>` : ''}`;
    card.querySelector('.btn-star').addEventListener('click', (e) => {
      toggleBookmarkAyat(data, a);
      const aktif = isBookmarked(data.nomor, a.n);
      e.target.textContent = aktif ? '★' : '☆';
      e.target.classList.toggle('aktif', aktif);
    });
    wrap.appendChild(card);
  }
}

function tutupReader() {
  $('#quran-reader-view').classList.add('hidden');
  $('#quran-list-view').classList.remove('hidden');
  renderResume();
}

// perbarui "terakhir dibaca" ke ayat yang berada di tengah layar
function simpanPosisiBaca() {
  if (!state.surahAktif || $('#quran-reader-view').classList.contains('hidden')) return;
  const tengah = window.innerHeight / 2;
  let terdekat = null, jarak = Infinity;
  document.querySelectorAll('.ayat-card').forEach((c) => {
    const r = c.getBoundingClientRect();
    const d = Math.abs((r.top + r.bottom) / 2 - tengah);
    if (d < jarak) { jarak = d; terdekat = c; }
  });
  if (terdekat) {
    const n = parseInt(terdekat.id.replace('ayat-', ''), 10);
    localStorage.setItem('sm_bookmark', JSON.stringify({ surah: state.surahAktif.nomor, ayat: n }));
  }
}
let gulirTimer = null;
window.addEventListener('scroll', () => {
  clearTimeout(gulirTimer);
  gulirTimer = setTimeout(simpanPosisiBaca, 400);
}, { passive: true });

/* ────────────────────────────────────────────────
   Kiblat
   ──────────────────────────────────────────────── */
function arahKiblat(lat, lng) {
  const dLng = rad(KAABA.lng - lng);
  const y = Math.sin(dLng);
  const x = Math.cos(rad(lat)) * Math.tan(rad(KAABA.lat)) - Math.sin(rad(lat)) * Math.cos(dLng);
  return fixAngle(darctan2(y, x));
}

let kompasAktif = false;

function renderKiblatInfo() {
  const q = arahKiblat(state.loc.lat, state.loc.lng);
  $('#kiblat-info').textContent =
    `Dari ${state.loc.nama}: ${q.toFixed(1)}° dari utara (searah jarum jam)`;
  // Jarum adalah anak dari dial, jadi cukup diputar sebesar sudut kiblat;
  // rotasi dial (−heading) otomatis ikut diterapkan padanya.
  $('#qibla-needle').style.setProperty('--rot', q + 'deg');
  if (!kompasAktif) {
    // tanpa kompas: dial diam (utara di atas), tegakkan ikon Ka'bah
    document.querySelector('.needle-kaaba').style.setProperty('--counter', -q + 'deg');
    $('#heading-readout').textContent = `Kiblat ${q.toFixed(1)}°`;
  }
  return q;
}

function onOrientasi(e) {
  let heading = null;
  if (typeof e.webkitCompassHeading === 'number') {
    heading = e.webkitCompassHeading; // iOS: derajat searah jarum jam dari utara
  } else if (e.absolute && typeof e.alpha === 'number') {
    heading = fixAngle(360 - e.alpha); // Android
  }
  if (heading === null) return;
  kompasAktif = true;
  const q = arahKiblat(state.loc.lat, state.loc.lng);
  // dial berputar mengikuti heading; jarum tetap di sudut kiblat PADA dial,
  // sehingga rotasi efektif ikon = q − heading (0 = tepat di atas)
  $('#compass-dial').style.transform = `rotate(${-heading}deg)`;
  $('#qibla-needle').style.setProperty('--rot', q + 'deg');
  // tegakkan glyph Ka'bah: batalkan total rotasi dial + jarum
  document.querySelector('.needle-kaaba').style.setProperty('--counter', (heading - q) + 'deg');
  $('#heading-readout').textContent = `Arahmu ${Math.round(heading)}° • Kiblat ${q.toFixed(1)}°`;

  let selisih = fixAngle(q - heading);
  if (selisih > 180) selisih -= 360;
  const status = $('#kiblat-status');
  if (Math.abs(selisih) <= 3) {
    status.textContent = '✅ Tepat menghadap kiblat!';
    status.classList.add('pas');
  } else {
    status.classList.remove('pas');
    status.textContent = selisih > 0
      ? `Putar ke kanan ${Math.round(Math.abs(selisih))}°`
      : `Putar ke kiri ${Math.round(Math.abs(selisih))}°`;
  }
}

async function aktifkanKompas() {
  renderKiblatInfo();
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      const izin = await DeviceOrientationEvent.requestPermission(); // iOS 13+
      if (izin !== 'granted') {
        $('#kiblat-status').textContent = 'Izin sensor gerak ditolak. Muat ulang lalu izinkan.';
        return;
      }
    }
    window.addEventListener('deviceorientationabsolute', onOrientasi, true);
    window.addEventListener('deviceorientation', onOrientasi, true);
    $('#btn-kompas').classList.add('hidden');
    $('#kiblat-status').textContent = 'Kompas aktif — putar tubuhmu hingga 🕋 berada di atas.';
  } catch (e) {
    $('#kiblat-status').textContent = 'Sensor kompas tidak tersedia di perangkat ini. Gunakan sudut derajat di atas dengan aplikasi Kompas bawaan.';
  }
}

/* ────────────────────────────────────────────────
   Navigasi tab + inisialisasi
   ──────────────────────────────────────────────── */
function renderSemua() {
  renderSholat();
  renderKiblatInfo();
}

function pindahTab(id) {
  document.querySelectorAll('.tabbtn').forEach((x) => x.classList.toggle('active', x.dataset.tab === id));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === id));
  window.scrollTo(0, 0);
  if (id === 'tab-simpan') renderTabSimpan();
}
document.querySelectorAll('.tabbtn').forEach((b) =>
  b.addEventListener('click', () => pindahTab(b.dataset.tab)));

$('#btn-lokasi').addEventListener('click', () => mintaLokasi(true));
$('#btn-kembali').addEventListener('click', tutupReader);
$('#btn-prev-surah').addEventListener('click', () => bukaSurah(state.surahAktif.nomor - 1));
$('#btn-next-surah').addEventListener('click', () => bukaSurah(state.surahAktif.nomor + 1));
$('#cari-surah').addEventListener('input', (e) => renderDaftarSurah(e.target.value));
$('#opt-latin').addEventListener('change', simpanOpsiDanRender);
$('#opt-terjemah').addEventListener('change', simpanOpsiDanRender);
$('#btn-kompas').addEventListener('click', aktifkanKompas);
document.querySelectorAll('#pilih-metode .segbtn').forEach((b) => {
  b.addEventListener('click', () => {
    metodeAktif = b.dataset.metode;
    localStorage.setItem('sm_metode', metodeAktif);
    renderSholat();
  });
});

function simpanOpsiDanRender() {
  localStorage.setItem('sm_opts', JSON.stringify({
    latin: $('#opt-latin').checked, id: $('#opt-terjemah').checked,
  }));
  renderAyat();
}

// ukuran huruf Arab
let arabSize = parseFloat(localStorage.getItem('sm_fontsize') || '1.75');
function terapkanFont() {
  document.documentElement.style.setProperty('--arab-size', arabSize + 'rem');
  localStorage.setItem('sm_fontsize', String(arabSize));
}
$('#btn-font-besar').addEventListener('click', () => { arabSize = Math.min(3, arabSize + 0.15); terapkanFont(); });
$('#btn-font-kecil').addEventListener('click', () => { arabSize = Math.max(1.1, arabSize - 0.15); terapkanFont(); });

// pulihkan opsi tampilan
const opts = JSON.parse(localStorage.getItem('sm_opts') || 'null');
if (opts) { $('#opt-latin').checked = !!opts.latin; $('#opt-terjemah').checked = !!opts.id; }
terapkanFont();

// mulai
renderSemua();
muatIndexSurah().then(() => { renderResume(); renderTabSimpan(); });
mintaLokasi(false);
setInterval(renderSholat, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderSemua();
});
