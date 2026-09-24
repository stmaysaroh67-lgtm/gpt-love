#!/bin/bash

echo "[SETUP] Memulai Inisialisasi Otomatis Codespace..."

# 1. Memastikan file package.json ada (Langkah Inisialisasi Proyek)
if [ ! -f "package.json" ]; then
  echo "[SETUP] package.json tidak ditemukan, membuat fondasi baru..."
  npm init -y
fi

# 2. Update sistem dan Instalasi Pustaka Grafis (WebGL/Xvfb)
echo "[SETUP] Menginstal dependensi OS untuk Xvfb dan WebGL..."
sudo apt-get update
sudo apt-get install -y xvfb libgl1 libglx-mesa0 libosmesa6 wget curl

# 3. Instalasi Modul NPM Generasi Baru (dan menghapus Puppeteer jika terbawa)
echo "[SETUP] Menyesuaikan dependensi NPM..."
npm uninstall puppeteer-core puppeteer-extra puppeteer-extra-plugin-stealth
npm install express cors @upstash/redis camoufox-js playwright

# 4. Instalasi Dependensi OS Tingkat Rendah untuk Playwright
echo "[SETUP] Meminta Playwright mengunduh dependensi OS Ubuntu..."
npx playwright install-deps firefox

# 5. Injeksi Mesin Inti Camoufox
echo "[SETUP] Mengunduh biner inti Camoufox C++..."
npx camoufox-js fetch

echo "[SETUP] ✅ Seluruh instalasi selesai dengan sempurna!"
