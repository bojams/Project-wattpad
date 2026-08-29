# Hideo Wattpad

Website untuk menyimpan dan mengelola riwayat cerita yang sudah kamu baca — lengkap dengan status baca, rating, progres bab, favorit, catatan, pencarian, filter, list kustom, dan backup otomatis.

## Cara Menjalankan

```bash
cd /home/bojam/project/hideo_wattpad
npm start          # atau: node server.js
```

Buka **http://localhost:3000** di browser.

Ganti port/host lewat environment variable:

```bash
PORT=8080 HOST=127.0.0.1 node server.js
```

> `HOST=127.0.0.1` membuat server hanya bisa diakses dari komputermu sendiri (lebih aman). Default `0.0.0.0` agar bisa dibuka dari HP dalam jaringan Wi-Fi yang sama.

Tanpa `npm install` — backend memakai modul bawaan Node.js (>= 18) saja.

## Fitur

- **Mode Baca di dalam aplikasi** — tombol *Baca* pada kartu cerita membuka pembaca layar penuh: daftar bab otomatis dari Wattpad, navigasi Sebelumnya/Berikutnya (juga tombol panah keyboard), ukuran huruf A-/A+, dan posisi bacaan terakhir tersimpan per cerita
- **Progres baca ala Wattpad** — di bawah navbar pembaca tersedia bar gradasi yang terisi saat scroll, estimasi total waktu baca bab (±200 kata/menit), persentase terbaca + sisa waktu yang berkurang realtime (menit → detik), dan notifikasi saat bab selesai, dan keluar otomatis ke daftar cerita saat bab terakhir selesai dibaca
- **Sinkronisasi otomatis "bab dibaca"** — membuka part ke-N otomatis menaikkan progres di kartu cerita (tidak pernah turun) dan langsung tersimpan ke server
- **Ambil otomatis dari Wattpad** — tempel tautan `wattpad.com/story/…`, lalu judul, penulis, cover, jumlah bab, dan sinopsis terisi otomatis (tombol *Ambil* untuk paksa perbarui semua)
- **List kustom** — buat daftar sendiri (mis. "Rekomendasi", "Baca Ulang"), kelompokkan cerita ke beberapa list sekaligus lewat form tambah/edit, filter grid per list via chip, dan kelola (buat/ganti nama/hapus) dari modal *Kelola List*
- **Multi-akun dengan login** — setiap akun punya cerita & list sendiri yang terpisah total; kata sandi di-hash scrypt + sesi cookie HttpOnly bertanda tangan HMAC; data lama otomatis dipindahkan ke akun `adinata79177@gmail.com` saat didaftarkan
- Tambah / edit / hapus cerita (judul, penulis, genre, status, rating bintang, progres bab, tautan Wattpad, cover URL, catatan)
- Status baca: Membaca, Selesai, Ditunda, Drop
- Dashboard statistik + filter chip status, genre, favorit, dan pencarian instan (shortcut `/`)
- Urutkan: terbaru, terlama, judul A–Z, rating tertinggi
- UI dark modern, responsif dari layar kecil sampai desktop, dukungan `prefers-reduced-motion` dan aksesibilitas dasar

## Struktur

```
hideo_wattpad/
├── server.js            # Backend API + static file server (Node murni)
├── package.json
├── public/              # Frontend
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js
│   └── favicon.svg
└── data/
    ├── users.json       # Daftar akun (email + hash kata sandi)
    ├── accounts/        # Data cerita & list per akun (1 file = 1 akun)
    ├── session-secret   # Kunci penandatanganan sesi (dibuat otomatis)
    ├── stories.json     # Data lama (sudah dimigrasi, disimpan sebagai cadangan)
    └── backups/         # Backup otomatis (saat server dinyalakan, maks 15 file)
```

## Keamanan

- **Zero dependensi** — tidak ada risiko supply-chain dari package pihak ketiga
- **CSP ketat**: `script-src 'self'`, tanpa inline script/style; semua konten user dirender via `textContent` (tahan XSS by construction)
- **Validasi & sanitasi input di sisi server**: tipe, panjang maksimal, whitelist enum status, validasi skema URL (`http`/`https`)
- **Rate limiting** 240 req/menit per IP untuk API
- **Proteksi CSRF/CORS**: cek header `Origin` dan `Sec-Fetch-Site` pada semua mutasi; tanpa cookie berarti tidak ada credential yang bisa disalahkan
- **Body limit** 64 KB + parsing JSON aman
- **Path traversal protection** pada static file server
- **Security headers**: `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP
- **Penyimpanan atomik** (tmp + rename) agar data tidak korup saat ditulis; auto-recovery dari folder backup jika file rusak
- Link eksternal memakai `rel="noopener noreferrer nofollow"` dan gambar cover dengan `referrerpolicy="no-referrer"`

## API

| Method | Endpoint              | Keterangan                    |
| ------ | --------------------- | ----------------------------- |
| GET    | `/api/stories`        | Ambil semua cerita            |
| POST   | `/api/stories`        | Tambah cerita                 |
| PUT    | `/api/stories/:id`    | Update cerita                 |
| DELETE | `/api/stories/:id`    | Hapus cerita                  |

| POST   | `/api/auth/register`  | Daftar akun baru              |
| POST   | `/api/auth/login`     | Masuk                         |
| POST   | `/api/auth/logout`    | Keluar                        |
| GET    | `/api/auth/me`        | Cek sesi aktif                |
| PUT    | `/api/auth/profile`   | Perbarui nama tampilan        |
| POST   | `/api/auth/password`  | Ubah kata sandi               |
| GET    | `/api/lists`          | Ambil semua list              |
| POST   | `/api/lists`          | Buat list baru                |
| PUT    | `/api/lists/:id`      | Ganti nama list               |
| DELETE | `/api/lists/:id`      | Hapus list (cerita aman)      |
| POST   | `/api/wattpad`        | Ambil metadata cerita dari Wattpad |
| GET    | `/api/wattpad/:id/parts` | Daftar bab cerita               |
| GET    | `/api/wattpad/part/:id`  | Isi teks satu bab               |

## Cara Kerja Mode Baca & Ambil Otomatis

1. Server mengambil ID cerita dari tautan (hanya host `wattpad.com|www|m`, path `/story/…` — proteksi SSRF).
2. Metadata & daftar bab dari endpoint internal resmi Wattpad (`api/v3/stories/{id}`); isi bab dari `apiv2/storytext`; jika API gagal, fallback ke scraping JSON-LD/meta tag.
3. Hasil dicache (bab 10 menit, teks bab 30 menit), rate limit terpisah per jenis (30–120 req/menit), timeout 12 detik, respons dibatasi 1,5–3 MB, redirect hanya boleh ke domain Wattpad.
4. Teks bab dirender sebagai paragraf polos via `textContent` — aman dari XSS meski sumbernya pihak ketiga.

> Catatan: fitur ini bergantung pada struktur internal Wattpad yang dapat berubah sewaktu-waktu; jika gagal, kolom tetap bisa diisi manual.
