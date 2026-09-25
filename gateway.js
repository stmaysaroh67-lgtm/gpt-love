const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const { Camoufox } = require('camoufox-js');
const { Redis } = require('@upstash/redis');
const chatgptModule = require('./platforms/chatgpt');

// 🌟 MENYALAKAN VIRTUAL DISPLAY (XVFB)
const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1280x800x24']);
process.env.DISPLAY = ':99';

// 🌟 KREDENSIAL REDIS
const redis = new Redis({
  url: 'https://pro-troll-111005.upstash.io', 
  token: 'gQAAAAAAAbGdAAIgcDIxMjg3MmE5NGIwNzY0MDNjOTJjMzA0ZTY5ZDc3YmMxYg',
});

const MAX_COOKIES = 150; 
const PORT = 3001;
const app = express();

app.use(cors());
app.use(express.json({ limit: '500mb' }));

const folderHasil = path.join(__dirname, 'hasil_media');
const folderTemp = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(folderHasil)) fs.mkdirSync(folderHasil);
if (!fs.existsSync(folderTemp)) fs.mkdirSync(folderTemp);
app.use('/files', express.static(folderHasil));

// =====================================================================
// 🌟 PEKERJA LATAR BELAKANG: RADAR PROXY (FAILOVER SYSTEM)
// =====================================================================
let isProxyHealthy = true; 

function monitorProxy() {
    exec('curl -s --max-time 10 -x socks5h://adpfmxukjo.localto.net:4971 https://api.ipify.org', (error, stdout) => {
        if (error || !stdout) {
            if (isProxyHealthy) {
                console.log(`\n[NETWORK] ⚠️ PROXY MATI! Rute dialihkan ke jaringan lokal Codespace.`);
                isProxyHealthy = false;
            }
        } else {
            if (!isProxyHealthy) {
                console.log(`\n[NETWORK] ✅ PROXY PULIH! SOCKS5 Aktif (IP: ${stdout.trim()}).`);
                isProxyHealthy = true;
            }
        }
    });
}
setInterval(monitorProxy, 30000);
monitorProxy(); 

// =====================================================================
// 🌟 VARIABEL STATUS GLOBAL
// =====================================================================
let isRetiring = false;      
let jumlahTugasAktif = 0;    

async function dapatkanSesiCookie() {
    let index = await redis.incr('global_chatgpt_index');
    if (index > MAX_COOKIES) {
        await redis.set('global_chatgpt_index', 1);
        index = 1;
    }
    const cookieKey = `cookie_chatgpt_${index}`;
    const rawData = await redis.get(cookieKey);
    if (!rawData) throw new Error(`[REDIS] Data tidak ditemukan: ${cookieKey}`);

    const formattedCookies = Object.entries(rawData).map(([key, value]) => ({
        name: key, value: String(value), domain: '.chatgpt.com', path: '/', secure: true, sameSite: 'Lax'
    }));

    return { id: cookieKey, cookies: formattedCookies };
}

app.post('/api/generate', async (req, res) => {
    if (isRetiring) return res.status(503).json({ error: "Sistem estafet aktif. Silakan request ulang." });

    jumlahTugasAktif++; 
    
    const { action = 'CHAT', prompt, isThinkingMode = false, fileArray = [] } = req.body;
    let translatedFiles = [];
    
    if (fileArray && fileArray.length > 0) {
        fileArray.forEach((fileObj, index) => {
            const matches = fileObj.base64.match(/^data:(.+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const buffer = Buffer.from(matches[2], 'base64');
                let originalExt = path.extname(fileObj.name);
                if (!originalExt) originalExt = '.bin'; 
                
                const safeName = `upload_${Date.now()}_${index}${originalExt}`;
                const tempFilePath = path.join(folderTemp, safeName);
                fs.writeFileSync(tempFilePath, buffer);
                translatedFiles.push(tempFilePath);
            }
        });
    }

    let browser, context;
    try {
        const sesi = await dapatkanSesiCookie();
        const gunakanProxy = isProxyHealthy; 
        console.log(`[GATEWAY] 🚀 Meluncurkan tugas | Pekerja Aktif: ${jumlahTugasAktif} | Akun: ${sesi.id}`);

        let baseFirefoxPrefs = {
            'webgl.force-enabled': true, 'webgl.disabled': false, 'webgl.osmesa': true,
            'layers.acceleration.force-enabled': true, 'dom.maxHardwareConcurrency': 8,
            'pdfjs.disabled': true, 'browser.helperApps.neverAsk.saveToDisk': 'application/pdf,image/webp'
        };

        if (gunakanProxy) {
            Object.assign(baseFirefoxPrefs, {
                'network.proxy.type': 1, 'network.proxy.socks': 'adpfmxukjo.localto.net',
                'network.proxy.socks_port': 4971, 'network.proxy.socks_version': 5,
                'network.proxy.socks_remote_dns': true, 'network.dns.disableIPv6': true
            });
        } else {
            baseFirefoxPrefs['network.proxy.type'] = 0; 
        }

        browser = await Camoufox({ headless: true, width: 1280, height: 720, geoip: gunakanProxy, firefoxUserPrefs: baseFirefoxPrefs });
        context = await browser.newContext({ acceptDownloads: true });
        await context.addCookies(sesi.cookies);

        const hasil = await chatgptModule.eksekusiChatGPT(action, prompt, isThinkingMode, translatedFiles, folderHasil, context);
        
        const activeUrl = await redis.get('active_gateway_url') || `http://localhost:${PORT}`;
        res.json({ status: "success", worker: sesi.id, network: gunakanProxy ? "Proxy" : "Local", text: hasil.text, fileUrls: hasil.files.map(f => `${activeUrl}/files/${f}`) });
        
    } catch (error) {
        console.error(`[GATEWAY] ❌ TUGAS GAGAL: ${error.message}`);
        res.status(500).json({ status: "failed", error: error.message });
    } finally {
        jumlahTugasAktif--; 
        console.log(`[GATEWAY] 📉 Tugas selesai. Pekerja Aktif Tersisa: ${jumlahTugasAktif}`);
        
        if (context) await context.close().catch(()=>{});
        if (browser) await browser.close().catch(()=>{});
        translatedFiles.forEach(file => { if (fs.existsSync(file)) fs.unlinkSync(file); });
    }
});

// =====================================================================
// 🌟 FUNGSI DEMO REQUEST AWAL (STARTUP QC TEST)
// =====================================================================
async function jalankanDemoAwal(activeUrl) {
    console.log(`\n[SYSTEM-DEMO] 🚀 Memulai tes Quality Control (Demo Request) ke ChatGPT...`);
    let browser, context;
    try {
        const sesi = await dapatkanSesiCookie();
        const gunakanProxy = isProxyHealthy;
        
        let baseFirefoxPrefs = {
            'webgl.force-enabled': true, 'webgl.disabled': false, 'webgl.osmesa': true,
            'layers.acceleration.force-enabled': true, 'dom.maxHardwareConcurrency': 8,
            'pdfjs.disabled': true, 'browser.helperApps.neverAsk.saveToDisk': 'application/pdf,image/webp'
        };

        if (gunakanProxy) {
            Object.assign(baseFirefoxPrefs, {
                'network.proxy.type': 1, 'network.proxy.socks': 'adpfmxukjo.localto.net',
                'network.proxy.socks_port': 4971, 'network.proxy.socks_version': 5,
                'network.proxy.socks_remote_dns': true, 'network.dns.disableIPv6': true
            });
        } else { baseFirefoxPrefs['network.proxy.type'] = 0; }

        browser = await Camoufox({ headless: true, width: 1280, height: 720, geoip: gunakanProxy, firefoxUserPrefs: baseFirefoxPrefs });
        context = await browser.newContext({ acceptDownloads: true });
        await context.addCookies(sesi.cookies);

        const promptDemo = "Berikan satu kalimat sapaan selamat datang yang sangat lucu, sedikit nyeleneh, dan penuh semangat untuk Bosku.";
        const hasil = await chatgptModule.eksekusiChatGPT('CHAT', promptDemo, false, [], folderHasil, context);

        console.log(`\n======================================================`);
        console.log(`🎉 [DEMO SUKSES] Sistem Otomasi 100% Sehat!`);
        console.log(`🤖 Pesan dari ChatGPT: "${hasil.text}"`);
        
        if (activeUrl) {
            await redis.set('active_gateway_url', activeUrl);
            console.log(`[SYSTEM] 🟢 TAUTAN CLOUDFLARE DIBUKA: Vercel sekarang dialihkan ke mesin ini!`);
        }
        console.log(`======================================================\n`);
        
    } catch (error) {
        console.error(`\n[SYSTEM-DEMO] ❌ Gagal menjalankan tes QC: ${error.message}`);
        console.log(`[SYSTEM-DEMO] ⚠️ URL Cloudflare DITAHAN. Codespace lama masih memegang kendali rute.\n`);
    } finally {
        if (context) await context.close().catch(()=>{});
        if (browser) await browser.close().catch(()=>{});
    }
}

// =====================================================================
// 🔄 ADVANCED PROTOKOL ESTAFET (ANTI-FLAG & AUTO-WIPE)
// =====================================================================
async function jalankanProtokolEstafet() {
    console.log(`\n[ESTAFET] ⏰ Waktu shift habis. Memulai protokol rotasi Ping-Pong...`);
    
    const repoFullName = process.env.GITHUB_REPOSITORY; 
    if (!repoFullName) {
        console.error(`[ESTAFET] ❌ ERROR: GITHUB_REPOSITORY environment variable tidak terdeteksi!`);
        return;
    }

    let rawPats = await redis.get('github_pats') || []; 
    let patShifts = await redis.get('pat_shift_quota') || {}; 
    let rawMyPat = await redis.get('current_active_pat');
    let myPat = (typeof rawMyPat === 'string' ? rawMyPat : "").trim();

    let validPats = rawPats.filter(pat => {
        if (patShifts[pat] === undefined) patShifts[pat] = 4;
        return patShifts[pat] > 0;
    });

    if (validPats.length === 0) {
        console.error(`[ESTAFET] ❌ FATAL ERROR: STOK GITHUB PAT HABIS! SILAKAN ISI ULANG REDIS!`);
        return;
    }

    let isSuccess = false;
    let nextPat;

    // 🌟 1. LOOPING ANTI-FLAG: Terus mencoba PAT selanjutnya jika PAT sebelumnya gagal/dibanned
    while (!isSuccess && validPats.length > 0) {
        let availablePats = validPats.filter(pat => pat.trim() !== myPat);
        
        if (availablePats.length > 0) {
            nextPat = availablePats[0]; 
        } else {
            nextPat = validPats[0]; 
        }

        console.log(`[ESTAFET] 🔄 Mencoba membangunkan mesin penerus dengan PAT: ${nextPat.substring(0, 8)}...`);

        try {
            // 🌟 2. AUTO-WIPER (PEMBERSIH PRA-PENCIPTAAN)
            // Mengecek dan menghancurkan semua Codespace lama yang tertinggal di akun tersebut
            const checkRes = await fetch(`https://api.github.com/user/codespaces`, {
                headers: { 'Authorization': `Bearer ${nextPat}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
            });
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (checkData.codespaces && checkData.codespaces.length > 0) {
                    console.log(`[ESTAFET] 🧹 Membersihkan ${checkData.codespaces.length} codespace usang/menggantung di akun penerus...`);
                    for (let cs of checkData.codespaces) {
                        await fetch(`https://api.github.com/user/codespaces/${cs.name}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${nextPat}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
                        });
                    }
                }
            }

            const repoRes = await fetch(`https://api.github.com/repos/${repoFullName}`, {
                headers: { 'Authorization': `Bearer ${nextPat}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
            });
            
            if (!repoRes.ok) throw new Error("Gagal akses Repo. PAT mungkin kena flag atau dicabut.");
            const repoData = await repoRes.json();

            const createRes = await fetch(`https://api.github.com/user/codespaces`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${nextPat}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
                body: JSON.stringify({
                    repository_id: repoData.id,
                    idle_timeout_minutes: 240
                })
            });

            if (!createRes.ok) {
                const errTxt = await createRes.text();
                throw new Error(`API Error: ${errTxt}`);
            }

            console.log(`[ESTAFET] ✅ Pabrik siluman penerus sukses dipesan dan sedang booting!`);
            isSuccess = true; 

            patShifts[nextPat] -= 1;
            await redis.set('pat_shift_quota', patShifts);
            await redis.set('current_active_pat', nextPat.trim()); 
            await redis.set('github_pats', validPats.filter(p => patShifts[p] > 0)); 

        } catch (err) {
            console.error(`[ESTAFET] ❌ Gagal menggunakan PAT ${nextPat.substring(0, 8)}... Alasan: ${err.message}`);
            console.log(`[ESTAFET] ⚠️ Menghapus PAT yang FLAGGED dari Redis, lanjut mencoba PAT berikutnya...`);
            
            validPats = validPats.filter(p => p !== nextPat);
            await redis.set('github_pats', validPats);
            delete patShifts[nextPat];
            await redis.set('pat_shift_quota', patShifts);
        }
    }

    if (!isSuccess) {
        console.error(`[ESTAFET] 🚨 SEMUA PAT GAGAL DIGUNAKAN! Sistem tidak dapat bereinkarnasi.`);
        return; 
    }

    // 🌟 SINKRONISASI DETAK JANTUNG
    console.log(`[ESTAFET] 📡 Menunggu mesin penerus menyelesaikan QC dan mengambil alih rute Cloudflare...`);
    const oldUrl = await redis.get('active_gateway_url');
    
    const pantauPengambilalihan = setInterval(async () => {
        const currentUrl = await redis.get('active_gateway_url');
        
        if (currentUrl && currentUrl !== oldUrl) {
            clearInterval(pantauPengambilalihan);
            console.log(`\n[ESTAFET] 🔄 PENGAMBILALIHAN BERHASIL! Rute tugas telah berpindah.`);
            
            isRetiring = true; 
            console.log(`[ESTAFET] 🛑 Menolak tugas baru. Menunggu ${jumlahTugasAktif} tugas tersisa diselesaikan...`);
            
            // 🌟 3. TIMEOUT PEMBUNUH DIRI: Batas waktu maksimal 5 menit untuk Graceful Draining
            let batasWaktuTunggu = 60; // 60 iterasi x 5 detik = 5 menit maksimal

            const cekSisaTugas = setInterval(async () => {
                batasWaktuTunggu--;
                if (jumlahTugasAktif === 0 || batasWaktuTunggu <= 0) {
                    clearInterval(cekSisaTugas);
                    
                    if (batasWaktuTunggu <= 0) console.log(`[ESTAFET] ⚠️ Waktu habis! Memaksa pembersihan tugas yang nyangkut.`);
                    console.log(`[ESTAFET] 🪦 Memulai penghancuran diri (Self-Destruct)...`);
                    
                    try {
                        const currentCodespaceName = process.env.CODESPACE_NAME;
                        if (currentCodespaceName && myPat) {
                            const delRes = await fetch(`https://api.github.com/user/codespaces/${currentCodespaceName}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${myPat}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
                            });
                            console.log(`[ESTAFET] Laporan Status Hancur Diri: HTTP ${delRes.status}`);
                        }
                    } catch (e) {
                        console.error(`[ESTAFET] Kesalahan saat memanggil API Hancur Diri: ${e.message}`);
                    }
                    process.exit(0); 
                }
            }, 5000);
        }
    }, 10000); 
}

// =====================================================================
// 🌟 INISIASI SERVER & CLOUDFLARE (INSTAN)
// =====================================================================
app.listen(PORT, async () => {
    console.log(`🚀 API Gateway Camoufox menyala di Port ${PORT}`);
    
    const rawMyPat = await redis.get('current_active_pat');
    const myPat = (typeof rawMyPat === 'string' ? rawMyPat : "").trim();
    
    if (!myPat) {
        let validPats = await redis.get('github_pats') || [];
        if (validPats.length > 0) await redis.set('current_active_pat', validPats[0].trim());
    }

    console.log(`[SYSTEM] 🚇 Memulai inisiasi Cloudflare Tunnel seketika...`);
    const cloudflaredPath = path.join(__dirname, 'cloudflared');
    try {
        if (!fs.existsSync(cloudflaredPath)) {
            console.log(`[SYSTEM] ⬇️ Mengunduh Cloudflared...`);
            require('child_process').execSync(`wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O "${cloudflaredPath}" && chmod +x "${cloudflaredPath}"`);
        }
        
        const cf = spawn(cloudflaredPath, ['tunnel', '--url', `http://localhost:${PORT}`]);
        let urlFound = false;
        
        cf.stderr.on('data', async (data) => {
            const match = data.toString().match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
            if (match && !urlFound) {
                urlFound = true;
                const activeUrl = match[0];
                
                console.log(`[SYSTEM] 🔎 Terowongan Tertangkap: ${activeUrl}`);
                console.log(`[SYSTEM] 🛑 Menahan publikasi URL ke Vercel sampai QC Test selesai...`);
                
                const SHIFT_DURATION_MS = 10 * 60 * 1000; // Mode Pengujian (3 Menit)
                setTimeout(jalankanProtokolEstafet, SHIFT_DURATION_MS);
                
                await jalankanDemoAwal(activeUrl);
            }
        });
        
        cf.on('close', (code) => {
            if(!urlFound) console.log(`[SYSTEM] ❌ Cloudflare terputus secara tak wajar.`);
        });
        
    } catch (err) { console.error(`[SYSTEM] ❌ Gagal menjalankan Cloudflare:`, err.message); }
});
