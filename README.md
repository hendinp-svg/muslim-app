# Sahabat Muslim (PWA)

Aplikasi iPhone tanpa App Store — di-install lewat Safari (Add to Home Screen).

**Fitur**
- 🕌 Jadwal sholat sesuai lokasi GPS — pilihan metode **Kemenag RI** (Subuh 20°,
  Isya 18°, + ihtiyat 2 menit) atau **Muslim World League** (Subuh 18°, Isya 17°),
  Ashar Syafi'i, lengkap dengan Imsak, Terbit, hitung mundur, dan tanggal Hijriah.
- 📖 Al-Qur'an 114 surah — teks Mushaf Al-Qur'an Standar Usmani Indonesia
  (Kemenag RI, via equran.id) dengan font resmi LPMQ Isep Misbah, transliterasi
  Latin, terjemahan Kemenag, pencarian surah, posisi terakhir dibaca yang
  tersimpan otomatis saat menggulir, dan pengatur ukuran huruf. Data tersimpan
  lokal → bisa dibaca offline.
- ⭐ Tab **Tersimpan** — bookmark ayat sebanyak apa pun (ketuk ☆ pada ayat),
  lihat semuanya di satu menu, ketuk untuk melompat langsung ke ayatnya.
- 🧭 Arah kiblat — kompas real-time (sensor iPhone) + sudut derajat dari utara,
  dihitung great-circle ke Ka'bah.

## Cara menaruh di internet (sekali saja, gratis)

Pilih salah satu — paling mudah **Netlify Drop**:

1. Buka https://app.netlify.com/drop di browser (buat akun gratis bila diminta).
2. Seret (drag & drop) **seluruh folder `muslim-app`** ke halaman itu.
3. Tunggu ±1 menit → kamu dapat alamat `https://nama-acak.netlify.app`.

Alternatif: Vercel (`npx vercel`), Cloudflare Pages, atau GitHub Pages —
semuanya otomatis HTTPS (wajib untuk PWA, GPS, dan sensor kompas).

## Cara install di iPhone

1. Buka alamat `https://…` tadi di **Safari** (harus Safari).
2. Ketuk tombol **Bagikan** (kotak dengan panah ke atas).
3. Ketuk **Tambah ke Layar Utama** (Add to Home Screen) → **Tambah**.
4. Ikon "Muslim" muncul di Home Screen — buka dari situ, jalan fullscreen.
5. Saat pertama dibuka: izinkan **akses lokasi** (untuk jadwal & kiblat), dan di
   tab Kiblat ketuk **Aktifkan Kompas** lalu izinkan **gerakan & orientasi**.

Surah yang pernah dibuka tersimpan otomatis dan bisa dibaca tanpa internet.

## Update aplikasi

Edit file → upload ulang folder ke alamat yang sama. Pengguna mendapat versi
baru saat aplikasi dibuka berikutnya (strategi stale-while-revalidate).

## Sumber data

- Teks Arab, Latin, dan terjemahan: Kemenag RI via API https://equran.id (v2).
- Font: LPMQ Isep Misbah — Lajnah Pentashihan Mushaf Al-Qur'an, Kemenag RI.
- Jadwal sholat & kiblat: dihitung lokal di perangkat (tanpa server).
