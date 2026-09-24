const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const nodeModulesPath = path.join(__dirname, 'node_modules');
const expressPath = path.join(nodeModulesPath, 'express');

console.log("[BOOTLOADER] 🔍 Memeriksa kesehatan sistem...");

// 1. SISTEM PENYEMBUH DIRI: Jika modul belum terinstal, instal otomatis!
if (!fs.existsSync(expressPath)) {
    console.log("[BOOTLOADER] ⚠️ Modul belum lengkap! Memulai 'npm install' otomatis...");
    try {
        execSync('npm install', { stdio: 'inherit' });
        console.log("[BOOTLOADER] ✅ Instalasi NPM berhasil.");
    } catch (error) {
        console.error("[BOOTLOADER] ❌ Gagal menginstal NPM:", error.message);
        process.exit(1);
    }
} else {
    console.log("[BOOTLOADER] ✅ Sistem modul sehat.");
}

// 2. MENYALAKAN GATEWAY TANPA PM2
console.log("[BOOTLOADER] 🚀 Menyalakan Gateway di bawah perlindungan Xvfb...");
const gateway = spawn('xvfb-run', ['--auto-servernum', 'node', 'gateway.js'], { stdio: 'inherit' });

gateway.on('close', (code) => {
    console.log(`[BOOTLOADER] 🛑 Gateway tertutup dengan kode ${code}`);
});
