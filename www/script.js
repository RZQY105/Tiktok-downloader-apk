// =========================================================
// 1. WELCOME INTRO & ELEGANT SYNTHESIZED CHIME (WEB AUDIO API)
// =========================================================
const welcomeOverlay = document.getElementById("welcomeOverlay");
let introSoundPlayed = false;

function playElegantChime() {
  if (introSoundPlayed) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Nada arpeggio harmonik Cmaj9 (elegan, modern, lembut)
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.085);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.085);
      gain.gain.exponentialRampToValueAtTime(0.09, now + idx * 0.085 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.085 + 1.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.085);
      osc.stop(now + idx * 0.085 + 1.15);
    });

    introSoundPlayed = true;
  } catch (e) {
    // Abaikan jika perangkat dalam mode senyap ketat
  }
}

window.addEventListener("DOMContentLoaded", () => {
  renderHistory();
  playElegantChime();

  setTimeout(() => {
    welcomeOverlay.classList.add("fade-out");
  }, 2200);
});

// =========================================================
// 2. EXIT CONFIRMATION (ANDROID BACK BUTTON HANDLER)
// =========================================================
const exitModal = document.getElementById("exitModal");
const cancelExitBtn = document.getElementById("cancelExitBtn");
const confirmExitBtn = document.getElementById("confirmExitBtn");

cancelExitBtn.addEventListener("click", () => {
  exitModal.classList.add("hidden");
});

confirmExitBtn.addEventListener("click", () => {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.exitApp();
  } else {
    window.close();
  }
});

// Daftarkan listener tombol Back hardware Android
document.addEventListener("deviceready", setupBackButton, false);
window.addEventListener("load", setupBackButton);

let backListenerRegistered = false;
function setupBackButton() {
  if (backListenerRegistered) return;
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    backListenerRegistered = true;
    window.Capacitor.Plugins.App.addListener("backButton", () => {
      // 1. Jika modal exit terbuka, tutup modal
      if (!exitModal.classList.contains("hidden")) {
        exitModal.classList.add("hidden");
        return;
      }
      // 2. Jika sedang di tab Riwayat, kembalikan ke Beranda dulu
      const historyView = document.getElementById("historyView");
      if (!historyView.classList.contains("hidden")) {
        switchMainView("homeView");
        return;
      }
      // 3. Tampilkan konfirmasi keluar
      exitModal.classList.remove("hidden");
    });
  }
}

// =========================================================
// 3. NAVIGASI BERANDA & RIWAYAT UNDUHAN
// =========================================================
const navBtns = document.querySelectorAll(".nav-btn");
const viewSections = document.querySelectorAll(".view-section");

function switchMainView(targetId) {
  navBtns.forEach((b) => {
    b.classList.toggle("active", b.dataset.view === targetId);
  });
  viewSections.forEach((sec) => {
    sec.classList.toggle("hidden", sec.id !== targetId);
  });
  if (targetId === "historyView") {
    renderHistory();
  }
}

navBtns.forEach((btn) => {
  btn.addEventListener("click", () => switchMainView(btn.dataset.view));
});

// =========================================================
// 4. MULTI-PLATFORM MEDIA EXTRACTOR (TIKTOK, YT, PINTEREST, WEB)
// =========================================================
const urlInput = document.getElementById("mediaUrl");
const pasteBtn = document.getElementById("pasteBtn");
const fetchBtn = document.getElementById("fetchBtn");
const statusMsg = document.getElementById("statusMsg");
const loader = document.getElementById("loader");
const loaderText = document.getElementById("loaderText");
const resultCard = document.getElementById("resultCard");

const thumbImg = document.getElementById("thumbImg");
const platformTag = document.getElementById("platformTag");
const authorName = document.getElementById("authorName");
const videoTitle = document.getElementById("videoTitle");
const musicTitle = document.getElementById("musicTitle");

const tabBtns = document.querySelectorAll(".tab-btn");
const videoOptions = document.getElementById("videoOptions");
const audioOptions = document.getElementById("audioOptions");
const downloadBtn = document.getElementById("downloadBtn");

const progressWrapper = document.getElementById("progressWrapper");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

let currentMedia = null;
let selectedFormat = "video";

const DEFAULT_THUMB = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='160' fill='%2314141d'><rect width='100%' height='100%'/><text x='50%' y='50%' fill='%2306b6d4' font-family='sans-serif' font-size='14' text-anchor='middle'>MEDIA</text></svg>";

pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      hideError();
    }
  } catch (e) {
    showError("Izin clipboard ditolak. Tempel link secara manual.");
  }
});

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedFormat = btn.dataset.type;

    if (selectedFormat === "video") {
      videoOptions.classList.remove("hidden");
      audioOptions.classList.add("hidden");
      downloadBtn.textContent = "Download Video ke Galeri";
    } else {
      videoOptions.classList.add("hidden");
      audioOptions.classList.remove("hidden");
      downloadBtn.textContent = "Download MP3 ke Musik";
    }
  });
});

function detectPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes("tiktok.com")) return "TikTok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("pinterest.com") || u.includes("pin.it")) return "Pinterest";
  if (u.includes("instagram.com")) return "Instagram";
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "Facebook";
  if (u.includes("twitter.com") || u.includes("x.com")) return "X / Twitter";
  return "Web Video";
}

fetchBtn.addEventListener("click", async () => {
  const rawLink = urlInput.value.trim();
  if (!rawLink || !rawLink.startsWith("http")) {
    showError("Masukkan link video yang valid (diawali http:// atau https://)");
    return;
  }

  const platform = detectPlatform(rawLink);
  hideError();
  resultCard.classList.add("hidden");
  loader.classList.remove("hidden");
  loaderText.textContent = `Mengambil data dari ${platform}...`;
  fetchBtn.disabled = true;

  try {
    let extracted = null;

    if (platform === "TikTok") {
      extracted = await extractTikTok(rawLink);
    } else if (platform === "Pinterest") {
      extracted = await extractPinterest(rawLink);
    } else if (/\.(mp4|webm|mov|mp3|m4a)(\?.*)?$/i.test(rawLink)) {
      extracted = extractDirectFile(rawLink, platform);
    } else {
      extracted = await extractMultiPlatform(rawLink, platform);
    }

    if (!extracted || (!extracted.videos.length && !extracted.audioUrl)) {
      throw new Error("Media tidak ditemukan atau tautan bersifat privat.");
    }

    currentMedia = extracted;
    renderResultCard(extracted);
  } catch (err) {
    showError(err.message || "Gagal memproses link. Coba periksa koneksi atau link lain.");
  } finally {
    loader.classList.add("hidden");
    fetchBtn.disabled = false;
  }
});

// A. Extractor TikTok (HD, SD, Watermark, MP3)
async function extractTikTok(url) {
  const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
  const json = await res.json();
  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || "Video TikTok tidak dapat diakses.");
  }

  const d = json.data;
  const videos = [];
  if (d.hdplay) videos.push({ label: "Kualitas HD (1080p)", desc: "Tanpa Watermark • Jernih", url: d.hdplay });
  if (d.play) videos.push({ label: "Kualitas SD (Standar)", desc: "Tanpa Watermark • Hemat Kuota", url: d.play });
  if (d.wmplay) videos.push({ label: "Original Watermark", desc: "Dengan Watermark TikTok", url: d.wmplay });

  return {
    id: d.id || Date.now(),
    platform: "TikTok",
    title: d.title || "Video TikTok",
    author: `@${d.author?.unique_id || "tiktok"}`,
    thumbnail: d.cover || DEFAULT_THUMB,
    videos,
    audioUrl: d.music || d.play,
    audioTitle: d.music_info?.title || "Original Sound TikTok",
    originalUrl: url,
  };
}

// B. Extractor Pinterest (Direct HTML Stream Parser + Fallback API)
async function extractPinterest(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36" }
    });
    const html = await res.text();

    const mp4Matches = [...html.matchAll(/https:\/\/v1\.pinimg\.com\/videos\/[^"'\s\\]+\.mp4/g)];
    const uniqueUrls = [...new Set(mp4Matches.map((m) => m[0]))];

    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
    const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);

    if (uniqueUrls.length > 0) {
      const hdUrl = uniqueUrls.find((u) => u.includes("720p")) || uniqueUrls[0];
      const videos = uniqueUrls.map((u, i) => ({
        label: u.includes("720p") ? "Kualitas HD (720p MP4)" : `Video Pinterest #${i + 1}`,
        desc: "Direct Stream Pinterest • Tanpa Watermark",
        url: u,
      }));

      return {
        id: Date.now(),
        platform: "Pinterest",
        title: titleMatch ? titleMatch[1] : "Video Pinterest",
        author: "Pinterest Pin",
        thumbnail: imgMatch ? imgMatch[1] : DEFAULT_THUMB,
        videos,
        audioUrl: hdUrl,
        audioTitle: "Audio dari Video Pinterest",
        originalUrl: url,
      };
    }
  } catch (e) {
    // Lanjut ke multi-platform fallback
  }
  return extractMultiPlatform(url, "Pinterest");
}

// C. Extractor Direct File Link (.mp4 / .mp3 dari situs mana pun)
function extractDirectFile(url, platform) {
  const isAudio = /\.(mp3|m4a)(\?.*)?$/i.test(url);
  const fileName = url.split("/").pop().split("?")[0] || "Direct Media";

  return {
    id: Date.now(),
    platform,
    title: decodeURIComponent(fileName),
    author: new URL(url).hostname,
    thumbnail: DEFAULT_THUMB,
    videos: isAudio ? [] : [{ label: "Original Direct Video", desc: "Kualitas Asli Sumber Web", url }],
    audioUrl: url,
    audioTitle: decodeURIComponent(fileName),
    originalUrl: url,
  };
}

// D. Extractor YouTube, IG, FB, X & Situs Web Lainnya (Multi-Provider + OG Scraper)
async function extractMultiPlatform(url, platform) {
  // Provider 1: VKR Multi-Platform API (mendukung YouTube, FB, IG, Twitter, dll)
  try {
    const res = await fetch(`https://vkrdownloader.xyz/server?api_key=vkrdownloader&vkr=${encodeURIComponent(url)}`);
    const json = await res.json();

    if (json && json.data && Array.isArray(json.data.downloads) && json.data.downloads.length > 0) {
      const d = json.data;
      const videos = [];
      let audioUrl = "";

      d.downloads.forEach((item) => {
        if (!item.url) return;
        const ext = (item.ext || "").toLowerCase();
        const fmt = item.format_id || item.quality || "HD";

        if (ext === "mp3" || ext === "m4a" || String(fmt).toLowerCase().includes("audio")) {
          if (!audioUrl) audioUrl = item.url;
        } else if (ext === "mp4" || !ext) {
          videos.push({
            label: `Video ${fmt.toUpperCase()}`,
            desc: `${platform} • Format MP4 ${item.size ? `(${item.size})` : ""}`,
            url: item.url,
          });
        }
      });

      if (videos.length > 0 || audioUrl) {
        return {
          id: Date.now(),
          platform,
          title: d.title || `Media ${platform}`,
          author: d.source || platform,
          thumbnail: d.thumbnail || DEFAULT_THUMB,
          videos: videos.slice(0, 4),
          audioUrl: audioUrl || (videos[0] ? videos[0].url : ""),
          audioTitle: d.title || `Audio ${platform}`,
          originalUrl: url,
        };
      }
    }
  } catch (e) {
    // Lanjut ke Provider 2
  }

  // Provider 2: Cobalt Open API
  try {
    const res = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, videoQuality: "1080" }),
    });
    const json = await res.json();

    if (json && json.url) {
      return {
        id: Date.now(),
        platform,
        title: json.filename || `Video ${platform}`,
        author: platform,
        thumbnail: DEFAULT_THUMB,
        videos: [{ label: "Kualitas Terbaik (HD MP4)", desc: `Direct Stream ${platform}`, url: json.url }],
        audioUrl: json.url,
        audioTitle: `Audio ${platform}`,
        originalUrl: url,
      };
    }
  } catch (e) {
    // Lanjut ke Web Meta Scraper
  }

  // Provider 3: Generic Website Video Scraper (<meta property="og:video"> / <video src>)
  const pageRes = await fetch(url);
  const html = await pageRes.text();
  const ogVideo = html.match(/<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i);
  const videoSrc = html.match(/<video[^>]+src=["']([^"']+\.mp4[^"']*)["']/i);
  const foundVideo = ogVideo ? ogVideo[1] : videoSrc ? videoSrc[1] : null;

  if (foundVideo) {
    const absoluteVideoUrl = new URL(foundVideo, url).href;
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);

    return {
      id: Date.now(),
      platform,
      title: ogTitle ? ogTitle[1] : `Video dari ${new URL(url).hostname}`,
      author: new URL(url).hostname,
      thumbnail: ogImage ? ogImage[1] : DEFAULT_THUMB,
      videos: [{ label: "Video Web (MP4)", desc: "Diekstrak langsung dari halaman web", url: absoluteVideoUrl }],
      audioUrl: absoluteVideoUrl,
      audioTitle: "Audio dari Halaman Web",
      originalUrl: url,
    };
  }

  throw new Error(`Link ${platform} tidak didukung atau diproteksi DRM/Login.`);
}

// =========================================================
// 5. RENDER HASIL ANALISIS & EKSEKUSI DOWNLOAD
// =========================================================
function renderResultCard(media) {
  thumbImg.src = media.thumbnail || DEFAULT_THUMB;
  thumbImg.onerror = () => { thumbImg.src = DEFAULT_THUMB; };
  platformTag.textContent = media.platform;
  authorName.textContent = media.author;
  videoTitle.textContent = media.title;
  musicTitle.textContent = media.audioTitle;

  videoOptions.innerHTML = "";
  if (media.videos.length > 0) {
    media.videos.forEach((v, index) => {
      const label = document.createElement("label");
      label.className = "option-item";
      label.innerHTML = `
        <input type="radio" name="quality" value="${index}" ${index === 0 ? "checked" : ""} />
        <div class="option-box">
          <span class="opt-title">${v.label}</span>
          <span class="opt-desc">${v.desc}</span>
        </div>
      `;
      videoOptions.appendChild(label);
    });
  } else {
    videoOptions.innerHTML = `<div class="audio-box"><span class="opt-desc">Hanya format audio yang tersedia untuk link ini.</span></div>`;
  }

  progressWrapper.classList.add("hidden");
  resultCard.classList.remove("hidden");
}

downloadBtn.addEventListener("click", async () => {
  if (!currentMedia) return;

  let targetUrl = "";
  let qualityLabel = "MP3 Audio";
  let ext = "mp4";

  if (selectedFormat === "audio") {
    targetUrl = currentMedia.audioUrl;
    ext = "mp3";
  } else {
    const checked = document.querySelector('input[name="quality"]:checked');
    const idx = checked ? parseInt(checked.value, 10) : 0;
    const chosen = currentMedia.videos[idx];
    if (!chosen) {
      showError("Pilih kualitas video terlebih dahulu.");
      return;
    }
    targetUrl = chosen.url;
    qualityLabel = chosen.label;
    ext = "mp4";
  }

  const safePlatform = currentMedia.platform.toLowerCase().replace(/[^a-z0-9]/g, "");
  const fileName = `${safePlatform}_${Date.now()}.${ext}`;

  await processDownloadAndMoveToHistory(targetUrl, fileName, qualityLabel, ext);
});

async function processDownloadAndMoveToHistory(url, fileName, qualityLabel, ext) {
  downloadBtn.disabled = true;
  hideError();
  progressWrapper.classList.remove("hidden");
  progressFill.style.width = "20%";
  progressText.textContent = "Mengunduh media...";

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Gagal mengambil stream file dari server.");

    progressFill.style.width = "60%";
    const blob = await response.blob();
    const mimeType = ext === "mp3" ? "audio/mpeg" : "video/mp4";
    let savedFolder = ext === "mp3" ? "Music/MediaDownloader" : "Movies/MediaDownloader";

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.MediaSaver) {
      progressFill.style.width = "85%";
      progressText.textContent = "Menyimpan ke Galeri HP...";

      const base64Data = await blobToBase64(blob);
      const res = await window.Capacitor.Plugins.MediaSaver.saveMedia({
        base64Data,
        fileName,
        mimeType,
      });
      if (res && res.folder) savedFolder = res.folder;
    } else {
      // Fallback jika diuji lewat browser biasa
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    }

    progressFill.style.width = "100%";

    // 1. SIMPAN KE RIWAYAT UNDUHAN
    addToHistory({
      id: Date.now(),
      platform: currentMedia.platform,
      title: currentMedia.title,
      thumbnail: currentMedia.thumbnail,
      quality: qualityLabel,
      ext: ext.toUpperCase(),
      fileName,
      folder: savedFolder,
      date: new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
    });

    // 2. OTOMATIS HILANGKAN DARI BERANDA & BERSIHKAN INPUT
    resultCard.classList.add("hidden");
    progressWrapper.classList.add("hidden");
    urlInput.value = "";
    currentMedia = null;

    showToast("Tersimpan di Galeri & dipindahkan ke Riwayat!");
  } catch (err) {
    showError("Gagal mengunduh: " + (err.message || err));
    progressWrapper.classList.add("hidden");
  } finally {
    downloadBtn.disabled = false;
  }
}

// =========================================================
// 6. MANAJEMEN RIWAYAT UNDUHAN (LOCALSTORAGE)
// =========================================================
const HISTORY_KEY = "mediavault_download_history";
const historyList = document.getElementById("historyList");
const emptyHistory = document.getElementById("emptyHistory");
const historyBadge = document.getElementById("historyBadge");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function addToHistory(item) {
  const list = getHistory();
  list.unshift(item);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  renderHistory();
}

function deleteHistoryItem(id) {
  const list = getHistory().filter((item) => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  renderHistory();
}

clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  showToast("Riwayat unduhan dibersihkan");
});

function renderHistory() {
  const list = getHistory();
  historyBadge.textContent = list.length;

  if (list.length === 0) {
    historyList.innerHTML = "";
    emptyHistory.classList.remove("hidden");
    clearHistoryBtn.classList.add("hidden");
    return;
  }

  emptyHistory.classList.add("hidden");
  clearHistoryBtn.classList.remove("hidden");
  historyList.innerHTML = "";

  list.forEach((item) => {
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `
      <img class="history-thumb" src="${item.thumbnail || DEFAULT_THUMB}" onerror="this.src='${DEFAULT_THUMB}'" alt="Thumb" />
      <div class="history-body">
        <div class="history-badges">
          <span class="h-badge platform">${item.platform}</span>
          <span class="h-badge">${item.ext} • ${item.quality}</span>
        </div>
        <div class="history-title">${item.title}</div>
        <div class="history-path">${item.folder}/${item.fileName}</div>
        <div class="history-path">${item.date}</div>
      </div>
      <button type="button" class="btn-del-item" title="Hapus dari riwayat">&times;</button>
    `;

    el.querySelector(".btn-del-item").addEventListener("click", () => {
      deleteHistoryItem(item.id);
    });

    historyList.appendChild(el);
  });
}

// =========================================================
// 7. UTILITAS
// =========================================================
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function showError(msg) {
  statusMsg.textContent = msg;
  statusMsg.classList.remove("hidden");
}

function hideError() {
  statusMsg.classList.add("hidden");
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}
