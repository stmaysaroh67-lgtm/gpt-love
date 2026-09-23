#!/bin/bash
echo "[SETUP] 🚀 Memulai Instalasi Infrastruktur Pabrik Siluman..."

# 1. Update sistem operasi & Instal paket grafis (Wajib untuk Camoufox/Playwright)
sudo apt-get update
sudo apt-get install -y xvfb libgbm-dev libnss3 libasound2 libatk-bridge2.0-0 libgtk-3-0

# 2. Instal semua dependensi Node.js
echo "[SETUP] 📦 Menginstal dependensi NPM..."
npm install

# 3. Instal PM2 secara global untuk menjaga server tetap hidup di latar belakang
echo "[SETUP] ⚙️ Memasang PM2 Process Manager..."
sudo npm install -g pm2

# 4. Menyalakan Gateway
echo "[SETUP] 🔥 Menyalakan API Gateway..."
pm2 start gateway.js --name "ai-gateway"

echo "[SETUP] ✅ Selesai! Mesin telah hidup dan mengambil alih tugas secara otonom."