#!/bin/bash

echo "[SETUP] Memulai Inisialisasi Otomatis Mesin 16GB..."

# 1. Inisialisasi package.json jika belum ada (Fondasi Proyek Node.js)
if [ ! -f "package.json" ]; then
  echo "[SETUP] Membuat package.json dasar..."
  npm init -y
fi

# 2. Update Sistem & Instalasi Pustaka Grafis (Esensial untuk WebGL/Xvfb)
echo "[SETUP] Menginstal Xvfb dan dependensi grafis tingkat lanjut..."
sudo apt-get update
sudo apt-get install -y xvfb libgl1 libglx-mesa0 libosmesa6 wget curl

# 3. Membersihkan Arsitektur Lama & Memasang Modul Generasi Baru + PM2
echo "[SETUP] Menyesuaikan dependensi NPM (Redis, Camoufox, Playwright, PM2)..."
npm uninstall puppeteer-core puppeteer-extra puppeteer-extra-plugin-stealth
npm install express cors @upstash/redis camoufox-js playwright
npm install -g pm2 

# 4. Memaksa instalasi dependensi OS Ubuntu tingkat rendah untuk Playwright
echo "[SETUP] Mengunduh paket OS tingkat rendah via Playwright..."
npx playwright install-deps firefox

# 5. Injeksi Mesin Inti Camoufox (Stealth Browser)
echo "[SETUP] Mengunduh biner Camoufox C++..."
npx camoufox-js fetch

echo "[SETUP] ✅ Seluruh instalasi DevContainer selesai!"
