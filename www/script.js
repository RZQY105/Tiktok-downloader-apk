// =========================================================
// 1. CINEMATIC INTRO & WARM POLYPHONIC CHIME
// =========================================================
const welcomeOverlay = document.getElementById("welcomeOverlay");
let introPlayed = false;

function playWarmIntroSound() {
  if (introPlayed) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    // Warm Rhodes-like Harmonic Chord (Fmaj9 -> Cmaj9 shimmer)
    const freqs = [349.23, 440.00, 523.25, 659.25, 783.99];
    const now = ctx.currentTime;

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(f, now + i * 0.06);

      gain.gain.setValueAtTime(0.0001, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.065, now + i * 0.06 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 1.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 1.4);
    });
    introPlayed = true;
  } catch (e) {}
}

window.addEventListener("DOMContentLoaded", () => {
  renderHistory();
  playWarmIntroSound();
  setTimeout(() => {
    welcomeOverlay.classList.add("fade-out");
  }, 2000);
});

// =========================================================
// 2. BOTTOM SHEET EXIT CONFIRMATION
// =========================================================
const exitSheet = document.getElementById("exitSheet");
const cancelExitBtn = document.getElementById("cancelExitBtn");
const confirmExitBtn = document.getElementById("confirmExitBtn");

cancelExitBtn.addEventListener("click", () => exitSheet.classList.add("hidden"));
exitSheet.addEventListener("click", (e) => {
  if (e.target === exitSheet) exitSheet.classList.add("hidden");
});

confirmExitBtn.addEventListener("click", () => {
  if (window.Capacitor?.Plugins?.App) {
    window.Capacitor.Plugins.App.exitApp();
  } else {
    window.close();
  }
});

let backRegistered = false;
function initBackHandler() {
  if (backRegistered) return;
  if (window.Capacitor?.Plugins?.App) {
    backRegistered = true;
    window.Capacitor.Plugins.App.addListener("backButton", () => {
      if (!exitSheet.classList.contains("hidden")) {
        exitSheet.classList.add("hidden");
        return;
      }
      if (!document.getElementById("historyView").classList.contains("hidden")) {
        switchDockView("homeView");
        return;
      }
      exitSheet.classList.remove("hidden");
    });
  }
}
document.addEventListener("deviceready", initBackHandler, false);
window.addEventListener("load", initBackHandler);

// =========================================================
// 3. FLOATING DOCK NAVIGATION
// =========================================================
const dockBtns = document.querySelectorAll(".dock-btn");
const viewSections = document.querySelectorAll(".view-section");

function switchDockView(targetId) {
  dockBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === targetId));
  viewSections.forEach((sec) => sec.classList.toggle("hidden", sec.id !== targetId));
  if (targetId === "historyView") renderHistory();
}

dockBtns.forEach((btn) => {
  btn.addEventListener("click", () => switchDockView(btn.dataset.view));
});

// =========================================================
// 4. INPUT & MULTI-PLATFORM EXTRACTOR
// =========================================================
const urlInput = document.getElementById("mediaUrl");
const clearInputBtn = document.getElementById("clearInputBtn");
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

const segBtns = document.querySelectorAll(".seg-btn");
const videoOptions = document.getElementById("videoOptions");
const audioOptions = document.getElementById("audioOptions");
const downloadBtn = document.getElementById("downloadBtn");
const downloadBtnLabel = document.getElementById("downloadBtnLabel");

const progressWrapper = document.getElementById("progressWrapper");
const progressStatus = document.getElementById("progressStatus");
const progressSpeed = document.getElementById("progressSpeed");
const progressFill = document.getElementById("progressFill");

let currentMedia = null;
let selectedFormat = "video";

const DEFAULT_THUMB = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='160' fill='%2312141c'><rect width='100%' height='100%'/><text x='50%' y='52%' fill='%2338bdf8' font-family='sans-serif' font-size='13' font-weight='bold' text-anchor='middle'>MEDIA</text></svg>";

urlInput.addEventListener("input", () => {
  clearInputBtn.classList.toggle("hidden", !urlInput.value.trim());
});

clearInputBtn.addEventListener("click", () => {
  urlInput.value = "";
  clearInputBtn.classList.add("hidden");
  hideError();
});

pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      clearInputBtn.classList.remove("hidden");
      hideError();
    }
  } catch (e) {
    showError("Izin clipboard dibatasi sistem. Tempel tautan secara manual.");
  }
});

segBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    segBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedFormat = btn.dataset.type;

    if (selectedFormat === "video") {
      videoOptions.classList.remove("hidden");
      audioOptions.classList.add("hidden");
      downloadBtnLabel.textContent = "Simpan ke Galeri";
    } else {
      videoOptions.classList.add("hidden");
      audioOptions.classList.remove("hidden");
      downloadBtnLabel.textContent = "Simpan MP3 ke Musik";
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
  if (u.includes("twitter.com") || u.includes("x.com")) return "X";
  return "Web";
}

fetchBtn.addEventListener("click", async () => {
  const rawLink = urlInput.value.trim();
  if (!rawLink || !rawLink.startsWith("http")) {
    showError("Masukkan tautan valid yang diawali http:// atau https://");
    return;
  }

  const platform = detectPlatform(rawLink);
  hideError();
  resultCard.classList.add("hidden");
  loader.classList.remove("hidden");
  loaderText.textContent = `Menganalisis stream ${platform}...`;
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
      throw new Error("Media tidak ditemukan atau akun bersifat privat.");
    }

    currentMedia = extracted;
    renderResultCard(extracted);
  } catch (err) {
    showError(err.message || "Gagal mengambil data media.");
  } finally {
    loader.classList.add("hidden");
    fetchBtn.disabled = false;
  }
});

async function extractTikTok(url) {
  const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
  const json = await res.json();
  if (json.code !== 0 || !json.data) throw new Error(json.msg || "Video TikTok tidak dapat diakses.");

  const d = json.data;
  const videos = [];
  if (d.hdplay) videos.push({ label: "Full HD Tanpa Watermark", desc: "Bitrate tinggi • Jernih", tag: "1080P", url: d.hdplay });
  if (d.play) videos.push({ label: "Standar Tanpa Watermark", desc: "Ukuran ringkas • Cepat", tag: "720P", url: d.play });
  if (d.wmplay) videos.push({ label: "Original Watermark", desc: "Versi bawaan TikTok", tag: "WM", url: d.wmplay });

  return {
    id: d.id || Date.now(),
    platform: "TikTok",
    referer: "https://www.tiktok.com/",
    title: d.title || "Video TikTok",
    author: `@${d.author?.unique_id || "tiktok"}`,
    thumbnail: d.cover || DEFAULT_THUMB,
    videos,
    audioUrl: d.music || d.play,
    audioTitle: d.music_info?.title || "Original Sound TikTok",
  };
}

async function extractPinterest(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36" }
    });
    const html = await res.text();
    const mp4Matches = [...html.matchAll(/https:\/\/v1\.pinimg\.com\/videos\/[^"'\s\\]+\.mp4/g)];
    const uniqueUrls = [...new Set(mp4Matches.map((m) => m[0]))];
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
    const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);

    if (uniqueUrls.length > 0) {
      const hdUrl = uniqueUrls.find((u) => u.includes("720p")) || uniqueUrls[0];
      const videos = uniqueUrls.map((u, i) => ({
        label: u.includes("720p") ? "Pinterest HD Stream" : `Pinterest Stream #${i + 1}`,
        desc: "Tanpa Watermark • Direct CDN",
        tag: u.includes("720p") ? "720P" : "MP4",
        url: u,
      }));

      return {
        id: Date.now(),
        platform: "Pinterest",
        referer: "https://www.pinterest.com/",
        title: titleMatch ? titleMatch[1] : "Video Pinterest",
        author: "Pinterest",
        thumbnail: imgMatch ? imgMatch[1] : DEFAULT_THUMB,
        videos,
        audioUrl: hdUrl,
        audioTitle: "Audio Video Pinterest",
      };
    }
  } catch (e) {}
  return extractMultiPlatform(url, "Pinterest");
}

function extractDirectFile(url, platform) {
  const isAudio = /\.(mp3|m4a)(\?.*)?$/i.test(url);
  const fileName = url.split("/").pop().split("?")[0] || "Direct Media";
  return {
    id: Date.now(),
    platform,
    referer: "",
    title: decodeURIComponent(fileName),
    author: new URL(url).hostname,
    thumbnail: DEFAULT_THUMB,
    videos: isAudio ? [] : [{ label: "Direct Original File", desc: "Sumber langsung dari server web", tag: "MP4", url }],
    audioUrl: url,
    audioTitle: decodeURIComponent(fileName),
  };
}

async function extractMultiPlatform(url, platform) {
  try {
    const res = await fetch(`https://vkrdownloader.xyz/server?api_key=vkrdownloader&vkr=${encodeURIComponent(url)}`);
    const json = await res.json();

    if (json?.data?.downloads?.length > 0) {
      const d = json.data;
      const videos = [];
      let audioUrl = "";

      d.downloads.forEach((item) => {
        if (!item.url) return;
        const ext = (item.ext || "").toLowerCase();
        const fmt = String(item.format_id || item.quality || "HD").toUpperCase();

        if (ext === "mp3" || ext === "m4a" || fmt.includes("AUDIO")) {
          if (!audioUrl) audioUrl = item.url;
        } else if (ext === "mp4" || !ext) {
          videos.push({
            label: `Kualitas ${fmt}`,
            desc: `${platform} ${item.size ? `• ${item.size}` : "• MP4 Stream"}`,
            tag: fmt.slice(0, 6),
            url: item.url,
          });
        }
      });

      if (videos.length > 0 || audioUrl) {
        return {
          id: Date.now(),
          platform,
          referer: "",
          title: d.title || `Media ${platform}`,
          author: d.source || platform,
          thumbnail: d.thumbnail || DEFAULT_THUMB,
          videos: videos.slice(0, 4),
          audioUrl: audioUrl || videos[0]?.url || "",
          audioTitle: d.title || `Audio ${platform}`,
        };
      }
    }
  } catch (e) {}

  try {
    const res = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ url, videoQuality: "1080" }),
    });
    const json = await res.json();
    if (json?.url) {
      return {
        id: Date.now(),
        platform,
        referer: "",
        title: json.filename || `Video ${platform}`,
        author: platform,
        thumbnail: DEFAULT_THUMB,
        videos: [{ label: "Kualitas Terbaik", desc: `Direct Stream ${platform}`, tag: "HD", url: json.url }],
        audioUrl: json.url,
        audioTitle: `Audio ${platform}`,
      };
    }
  } catch (e) {}

  const pageRes = await fetch(url);
  const html = await pageRes.text();
  const ogVideo = html.match(/<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i);
  const videoSrc = html.match(/<video[^>]+src=["']([^"']+\.mp4[^"']*)["']/i);
  const foundVideo = ogVideo ? ogVideo[1] : videoSrc ? videoSrc[1] : null;

  if (foundVideo) {
    const absUrl = new URL(foundVideo, url).href;
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    return {
      id: Date.now(),
      platform,
      referer: url,
      title: ogTitle ? ogTitle[1] : `Video dari ${new URL(url).hostname}`,
      author: new URL(url).hostname,
      thumbnail: ogImage ? ogImage[1] : DEFAULT_THUMB,
      videos: [{ label: "Web Video Stream", desc: "Diekstrak dari halaman web", tag: "MP4", url: absUrl }],
      audioUrl: absUrl,
      audioTitle: "Audio Halaman Web",
    };
  }

  throw new Error(`Tautan ${platform} tidak didukung atau memerlukan login.`);
}

// =========================================================
// 5. RENDER HASIL & HIGH-SPEED NATIVE STREAM DOWNLOAD
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
    media.videos.forEach((v, idx) => {
      const label = document.createElement("label");
      label.className = "quality-item";
      label.innerHTML = `
        <input type="radio" name="quality" value="${idx}" ${idx === 0 ? "checked" : ""} />
        <div class="quality-card">
          <div class="q-left">
            <span class="q-title">${v.label}</span>
            <span class="q-desc">${v.desc}</span>
          </div>
          <span class="q-tag">${v.tag || "MP4"}</span>
        </div>
      `;
      videoOptions.appendChild(label);
    });
  } else {
    videoOptions.innerHTML = `<div class="quality-card"><span class="q-desc">Hanya tersedia format audio untuk tautan ini.</span></div>`;
  }

  progressWrapper.classList.add("hidden");
  resultCard.classList.remove("hidden");
}

downloadBtn.addEventListener("click", async () => {
  if (!currentMedia) return;

  let targetUrl = "";
  let qualityLabel = "MP3";
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
    qualityLabel = chosen.tag || chosen.label;
    ext = "mp4";
  }

  const safePrefix = currentMedia.platform.toLowerCase().replace(/[^a-z0-9]/g, "");
  const fileName = `${safePrefix}_${Date.now()}.${ext}`;
  await executeFastDownload(targetUrl, fileName, qualityLabel, ext);
});

async function executeFastDownload(url, fileName, qualityLabel, ext) {
  downloadBtn.disabled = true;
  hideError();
  progressWrapper.classList.remove("hidden");
  progressFill.style.width = "8%";
  progressStatus.textContent = "Menghubungkan stream...";
  progressSpeed.textContent = "Turbo";

  const mimeType = ext === "mp3" ? "audio/mpeg" : "video/mp4";
  let savedFolder = ext === "mp3" ? "Music/MediaVault" : "Movies/MediaVault";
  let progressListener = null;

  try {
    if (window.Capacitor?.Plugins?.MediaSaver?.downloadAndSave) {
      // Dengarkan kecepatan & persentase langsung dari Native Java Thread
      progressListener = await window.Capacitor.Plugins.MediaSaver.addListener("downloadProgress", (data) => {
        if (data.percent > 0) {
          progressFill.style.width = `${data.percent}%`;
          progressStatus.textContent = `Mengunduh ${data.percent}% (${data.downloadedMB} MB)`;
        } else {
          progressFill.style.width = "65%";
          progressStatus.textContent = `Mengunduh ${data.downloadedMB} MB...`;
        }
        progressSpeed.textContent = data.speed || "";
      });

      const res = await window.Capacitor.Plugins.MediaSaver.downloadAndSave({
        url,
        fileName,
        mimeType,
        referer: currentMedia.referer || "",
      });

      if (res?.folder) savedFolder = res.folder;
    } else {
      // Fallback jika dites di browser Acode
      const response = await fetch(url);
      if (!response.ok) throw new Error("Gagal mengambil media.");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    }

    progressFill.style.width = "100%";

    // Simpan ke Riwayat Unduhan
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

    // Bersihkan Beranda otomatis
    resultCard.classList.add("hidden");
    progressWrapper.classList.add("hidden");
    urlInput.value = "";
    clearInputBtn.classList.add("hidden");
    currentMedia = null;

    showToast("Tersimpan di Galeri & masuk ke Riwayat");
  } catch (err) {
    showError(err.message || "Gagal mengunduh file.");
    progressWrapper.classList.add("hidden");
  } finally {
    if (progressListener) progressListener.remove();
    downloadBtn.disabled = false;
  }
}

// =========================================================
// 6. MANAJEMEN RIWAYAT UNDUHAN
// =========================================================
const HISTORY_KEY = "mediavault_pro_history";
const historyList = document.getElementById("historyList");
const emptyHistory = document.getElementById("emptyHistory");
const historyBadge = document.getElementById("historyBadge");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch (e) { return []; }
}

function addToHistory(item) {
  const list = getHistory();
  list.unshift(item);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  renderHistory();
}

clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  showToast("Riwayat dibersihkan");
});

function renderHistory() {
  const list = getHistory();
  historyBadge.textContent = list.length;
  historyBadge.classList.toggle("hidden", list.length === 0);

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
    const card = document.createElement("div");
    card.className = "history-card";
    card.innerHTML = `
      <img src="${item.thumbnail || DEFAULT_THUMB}" onerror="this.src='${DEFAULT_THUMB}'" alt="Thumb" />
      <div class="h-info">
        <div class="h-tags">
          <span class="h-tag">${item.platform}</span>
          <span class="h-tag green">${item.ext} • ${item.quality}</span>
        </div>
        <div class="h-title">${item.title}</div>
        <div class="h-sub">${item.folder}/${item.fileName}</div>
        <div class="h-sub">${item.date}</div>
      </div>
      <button type="button" class="btn-remove-h" title="Hapus">&times;</button>
    `;

    card.querySelector(".btn-remove-h").addEventListener("click", () => {
      const updated = getHistory().filter((x) => x.id !== item.id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      renderHistory();
    });

    historyList.appendChild(card);
  });
}

// =========================================================
// 7. UTILITAS
// =========================================================
function showError(msg) {
  statusMsg.textContent = msg;
  statusMsg.classList.remove("hidden");
}

function hideError() {
  statusMsg.classList.add("hidden");
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  document.getElementById("toastText").textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2800);
}
