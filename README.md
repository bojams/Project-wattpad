# 📚 Hideo Wattpad

Website untuk **mencatat, mengelola, dan melanjutkan** riwayat cerita Wattpad yang kamu baca — semua dalam satu tempat. Tambah cerita, beri rating & status, pantau progres bab, baca langsung di dalam aplikasi, dan dapatkan notifikasi ketika ada bab baru.

> **Tanpa *database* dan tanpa dependensi npm** — cukup **Node.js** dan semua data tersimpan sebagai file JSON lokal.

**Repo GitHub:** [github.com/bojams/Project-wattpad](https://github.com/bojams/Project-wattpad)

---

## 📑 Daftar Isi

- [✨ Daftar Fitur](#-daftar-fitur)
- [⏱️ Mulai Cepat (Clone & Jalankan)](#-mulai-cepat-clone--jalankan)
- [🧰 Persyaratan](#-persyaratan)
- [🚀 Cara Menjalankan](#-cara-menjalankan)
- [📖 Panduan Penggunaan (Langkah demi Langkah)](#-panduan-penggunaan-langkah-demi-langkah)
- [🗂️ Struktur Proyek](#-struktur-proyek)
- [🔌 Referensi API](#-referensi-api)
- [🛡️ Keamanan](#-keamanan)
- [⚙️ Cara Kerja Fitur Wattpad](#-cara-kerja-fitur-wattpad)

---

## ✨ Daftar Fitur

### Manajemen Cerita
- Tambah / edit / hapus cerita (judul, penulis, genre, status, rating bintang, progres bab, tautan Wattpad, cover, catatan)
- **Ambil otomatis dari Wattpad**: tempel tautan `wattpad.com/story/…`, lalu judul, penulis, cover, jumlah bab, dan sinopsis terisi otomatis
- Status baca: **Membaca**, **Ongoing**, **Selesai**, **Ditunda**, **Drop**
- Rating 1–5 bintang dengan animasi

### Membaca
- **Reader internal**: baca bab penuh di dalam aplikasi tanpa pindah tab
- Daftar bab otomatis dari Wattpad, navigasi **Sebelumnya / Berikutnya** (termasuk tombol panah keyboard)
- Ukuran huruf **A− / A+**, posisi baca terakhir tersimpan per cerita
- **Progres otomatis**: membuka bab ke-N otomatis menaikkan progres di kartu cerita (tidak pernah turun) dan tercatat rapi
- Bar progres gradasi saat scroll, estimasi waktu baca, persentase + sisa waktu realtime

### Pencarian & Filter
- Statistik dashboard (total, sedang dibaca, ongoing, selesai)
- Filter chip status & genre, pencarian instan (shortcut **`/`**)
- Urutkan: terbaru, terlama, judul A–Z, rating tertinggi

### List Kustom
- Buat daftar sendiri (mis. "Rekomendasi", "Baca Ulang")
- Kelompokkan satu cerita ke **beberapa list sekaligus**
- Filter grid per list, dan kelola (buat / ganti nama / hapus) dari modal

### Notifikasi Update
- Deteksi bab baru secara otomatis (interval bisa diatur 5–1440 menit)
- Badge notifikasi di dalam aplikasi + notifikasi browser saat tab tidak aktif
- **Kirim ke Discord** via webhook (dengan ping role opsional)
- Notifikasi *heartbeat* status server ke pemilik

### Akun & Keamanan
- Multi-akun dengan login — data tiap akun terpisah total
- Kata sandi di-hash **scrypt** + sesi cookie **HttpOnly** bertanda tangan HMAC
- Rate limiting, proteksi CSRF/CORS, anti-SSRF, anti-XSS
- Backup otomatis setiap server dinyalakan

---

## ⏱️ Mulai Cepat (Clone & Jalankan)

Punya Git dan Node.js di komputermu? Cukup 3 langkah:

```bash
# 1. Ambil source code dari GitHub
git clone https://github.com/bojams/Project-wattpad.git
cd Project-wattpad

# 2. Jalankan server (tanpa npm install — sudah lengkap)
node server.js

# 3. Buka di browser
#    http://localhost:3000
```

Selesai — aplikasi langsung jalan dan kamu bisa daftar akun lalu mulai mencatat cerita.

---

## 🧰 Persyaratan

| Kebutuhan     | Keterangan                                        |
| ------------- | ------------------------------------------------- |
| **Node.js**   | Versi **≥ 18** (memakai modul bawaan, tanpa `npm install`) |
| **git**       | Untuk clone (jika download ZIP, git tidak wajib)  |
| **Browser**   | Modern: Chrome, Firefox, Edge, Safari             |

Cek versi Node di terminal: `node -v` (harus keluar `v18.x` atau lebih baru).

---

## 🚀 Cara Menjalankan

### Jika sudah punya foldernya (tanpa clone)

```bash
cd Project-wattpad
npm start          # atau langsung: node server.js
```

Buka **http://localhost:3000** di browser.

### Ganti port / host

```bash
PORT=8080 HOST=127.0.0.1 node server.js
```

> `HOST=127.0.0.1` (default) membuat server hanya bisa diakses dari komputermu sendiri — lebih aman.
> Pakai `HOST=0.0.0.0` jika ingin diakses dari HP/PC lain dalam satu jaringan Wi-Fi.

---

## 📖 Panduan Penggunaan (Langkah demi Langkah)

### 1. Daftar Akun & Masuk

1. Buka aplikasi → langsung muncul layar **Masuk / Daftar**.
2. Klik tab **Daftar**, isi **email** dan **kata sandi**.
   - Kata sandi: minimal 8 karakter, wajib mengandung huruf besar, huruf kecil, dan angka.
3. Klik **Daftar** → sesi langsung aktif.
4. Lain kali cukup klik **Masuk** dengan email & sandi yang sama.
5. Untuk keluar: buka menu profil → **Keluar**.

### 2. Tambah Cerita (Cara Cepat & Otomatis)

**Cara otomatis dari Wattpad (paling mudah):**
1. Klik tombol **+ Tambah Cerita** (atau kartu kosong di grid).
2. Tempel tautan cerita Wattpad, contoh: `https://www.wattpad.com/story/1234567/judul-cerita`
3. Klik **Ambil** (bulatan panah di samping kolom tautan).
4. Judul, penulis, cover, jumlah bab, dan sinopsis terisi **otomatis**.
5. Cukup pilih **status** dan klik **Simpan**.

**Cara manual:**
1. **+ Tambah Cerita** → isi formulir sendiri.
2. Kolom wajib: **Judul**. Kolom lain opsional (penulis, genre, status, rating, progres, tautan, cover URL, catatan).
3. Klik **Simpan**.

> **Cover**: isi URL gambar `https://…` untuk memakai cover asli, atau kosongkan untuk tampil inisial judul berwarna.

### 3. Kelola List Cerita

List mirip folder untuk mengelompokkan cerita.

- **Membuat list saat menambah/mengedit cerita**: di form cerita ada kolom *"List tersedia"* → tulis nama list baru → **Buat List**, lalu centang list mana yang diinginkan.
- **Mengelola list**: dari tombol *Kelola List* → buat, ganti nama, atau hapus. Menghapus list **tidak** menghapus ceritanya.
- **Memfilter per list**: klik chip nama list di atas grid untuk menampilkan hanya cerita dalam list itu.
- Satu cerita bisa masuk ke **beberapa list** sekaligus.

### 4. Membaca Bab di Dalam Aplikasi

1. Pada kartu cerita yang punya tautan Wattpad, klik tombol **Baca**.
2. Pembaca layar penuh terbuka → daftar bab tampil di samping.
3. Pilih bab, atau navigasi dengan **Sebelumnya / Berikutnya** / tombol **panah ← →** keyboard.
4. Atur kenyamanan: tombol **A− / A+** untuk ukuran huruf.
5. Posisi baca terakhir **tersimpan otomatis** — buka lagi cerita yang sama akan kembali ke bab terakhir.
6. Progres **bab dibaca** di kartu cerita ikut naik otomatis dan langsung tersimpan.
7. Saat bab terakhir selesai, kamu otomatis dikembalikan ke daftar cerita.

### 5. Mencari, Memfilter, Mengurutkan

- **Cari**: tekan **`/`** lalu ketik — hasil menyaring secara langsung (judul, penulis, genre).
- **Filter status**: chip Membaca / Ongoing / Selesai / Ditunda / Drop.
- **Filter genre**: pilih genre dari daftar chip.
- **Urutkan**: dropdown urutan — terbaru, terlama, A–Z, rating tertinggi.

### 6. Melihat Statistik

Di bagian atas beranda tersedia kartu ringkasan: **Total Cerita**, **Sedang Dibaca**, **Ongoing**, **Selesai**. Angka ini ter-update otomatis setiap kali kamu menambah/mengedit cerita.

### 7. Nyalakan Notifikasi Update Cerita

1. Klik **ikon lonceng** di pojok kanan atas.
2. Klik **Cek sekarang** untuk memeriksa bab baru saat itu juga.
3. Klik **"Aktifkan notifikasi browser"** agar mendapat peringatan walau tab tidak aktif (opsional).
4. Badge merah menunjukkan jumlah cerita yang punya bab baru; klik **"Tandai dibaca"** untuk menutupnya.

**Kirim notifikasi ke Discord:**
1. Buat webhook di server Discord (`Pengaturan Server → Integrations → Webhooks`).
2. Salin URL webhook.
3. Buka **Profil** → tempel di kolom *Webhook Discord* → centang aktifkan → **Uji Webhook** untuk memastikan.
4. (Opsional) isi *Role ID* agar bisa ping role tertentu.
5. Atur **Interval Pengecekan** (5–1440 menit) sesuai keinginan.

### 8. Pengaturan Akun & Profil

Buka **menu profil** untuk:
- Ganti **nama tampilan** & **foto profil**
- Ubah **kata sandi** (perlu sandi lama; semua sesi lain otomatis berakhir)
- Atur **webhook Discord**, **role ID**, dan **interval pengecekan**
- **Keluar** dari akun

---

## 🗂️ Struktur Proyek

```
Project-wattpad/
├── server.js            # Backend API + static file server (Node murni)
├── package.json
├── README.md
├── .env                 # Konfigurasi (tidak ikut di-commit)
├── public/              # Frontend (di-serve server.js)
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js
│   └── favicon.svg
└── data/                # Dibuat otomatis saat server pertama dijalankan
    ├── users.json       # Daftar akun (email + hash sandi scrypt)
    ├── accounts/        # Data cerita & list per akun (1 file = 1 akun)
    ├── session-secret   # Kunci penandatanganan sesi (dibuat otomatis)
    ├── updates.json     # Status pembaruan / terakhir dicek
    ├── heartbeat.json   # Status server (untuk notifikasi pemilik)
    ├── stories.json     # Data lama (cadangan dari versi sebelumnya)
    └── backups/         # Backup otomatis (maks. 15 file, dirotasi)
```

> **Penting**: folder `data/` dan file `.env` **tidak** ikut di-commit ke GitHub — aman untuk repo publik.

---

## 🔌 Referensi API

Semua endpoint di bawah prefix `/api` dan butuh sesi login (kecuali `login`/`register`).

| Metode  | Endpoint                 | Keterangan                              |
| ------- | ------------------------ | --------------------------------------- |
| POST    | `/api/auth/register`     | Daftar akun baru                        |
| POST    | `/api/auth/login`        | Masuk (set cookie sesi)                 |
| POST    | `/api/auth/logout`       | Keluar (mencabut semua sesi)            |
| GET     | `/api/auth/me`           | Cek sesi aktif                          |
| PUT     | `/api/auth/profile`      | Perbarui profil (nama, foto, webhook, interval) |
| POST    | `/api/auth/password`     | Ubah kata sandi                         |
| POST    | `/api/auth/test-webhook` | Kirim pesan uji ke webhook Discord      |
| POST    | `/api/auth/check-webhook`| Periksa validitas webhook Discord       |
| GET     | `/api/stories`           | Ambil semua cerita                      |
| POST    | `/api/stories`           | Tambah cerita                           |
| PUT     | `/api/stories/:id`       | Update cerita (mis. progres bab)        |
| DELETE  | `/api/stories/:id`       | Hapus cerita                            |
| GET     | `/api/lists`             | Ambil semua list                        |
| POST    | `/api/lists`             | Buat list baru                          |
| PUT     | `/api/lists/:id`         | Ganti nama list                         |
| DELETE  | `/api/lists/:id`         | Hapus list (cerita di dalamnya aman)    |
| POST    | `/api/wattpad`           | Ambil metadata cerita dari Wattpad      |
| GET     | `/api/wattpad/:id/parts` | Daftar bab cerita                       |
| GET     | `/api/wattpad/part/:id`  | Isi teks satu bab                       |
| GET     | `/api/updates`           | Daftar pembaruan & status cek           |
| POST    | `/api/updates/check`     | Cek otomatis bab baru sekarang          |
| POST    | `/api/updates/seen`      | Tandai notifikasi sudah dibaca          |

---

## 🛡️ Keamanan

- **Zero dependensi** — tidak ada risiko supply-chain dari package pihak ketiga
- **Kata sandi** di-hash dengan **scrypt** + salt acak per akun; login memakai perbandingan waktu-konstan (anti timing-attack)
- **Sesi** cookie `HttpOnly`, `SameSite=Lax`, ditandatangani HMAC dengan TTL 30 hari; berakhir saat ganti sandi/keluar
- **Anti-XSS**: CSP ketat (`script-src 'self'`, tanpa inline script/style) + semua konten user dirender via `textContent`
- **Anti-SSRF**: permintaan ke Wattpad hanya boleh ke host `wattpad.com` yang disetujui; redirect divalidasi ulang per-hop
- **Anti-CSRF**: cek header `Origin` & `Sec-Fetch-Site` pada semua operasi mutasi
- **Rate limiting**: batas per-IP per endpoint (mis. login/register 5/menit, API umum 300/menit)
- **Validasi input**: tipe, panjang maksimal, whitelist enum, validasi skema URL
- **Path traversal protection** pada static file server; body dibatasi 64 KB
- **Security headers**: `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, HSTS
- **Penyimpanan atomik** (tmp + rename) agar data tidak korup; backup otomatis & auto-recovery

---

## ⚙️ Cara Kerja Fitur Wattpad

1. Server mengekstrak **ID cerita** dari tautan (hanya host `wattpad.com`, `www.wattpad.com`, `m.wattpad.com` dengan path `/story/…`).
2. **Metadata & daftar bab** diambil dari API internal Wattpad (`api/v3/stories/{id}`); **isi bab** dari `apiv2/storytext`.
3. Jika API gagal, ada *fallback* scraping dari tag meta / JSON-LD halaman cerita.
4. Hasil di-cache (bab 10 menit, teks 30 menit), dibatasi ukuran & timeout, dengan rate limit terpisah.
5. Isi bab dirender sebagai **paragraf polos** via `textContent` — aman walau bersumber dari pihak ketiga.
6. Saat membuka part ke-N, progres otomatis tersimpan; sistem notifikasi me-laporkan ketika `jumlah bab terbaru > jumlah yang diketahui`.

> Fitur ini bergantung pada struktur internal Wattpad yang bisa berubah sewaktu-waktu; jika satu metode gagal, _fallback_ otomatis dijalankan, dan kita masih bisa mencatat cerita secara manual.