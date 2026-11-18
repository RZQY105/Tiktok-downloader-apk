// Endpoint API publik untuk mengambil metadata & link TikTok
const API_ENDPOINT = "https://www.tikwm.com/api/";

const urlInput = document.getElementById("tiktokUrl");
const pasteBtn = document.getElementById("pasteBtn");
const fetchBtn = document.getElementById("fetchBtn");
const statusMsg = document.getElementById("statusMsg");
const loader = document.getElementById("loader");
const resultCard = document.getElementById("resultCard");

const thumbImg = document.getElementById("thumbImg");
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

let currentMediaData = null;
let selectedFormat = "video"; // 'video' atau 'audio'

// 1. Tombol Tempel (Paste otomatis dari clipboard HP)
pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      hideError();
    }
  } catch (err) {
    showError("Izin clipboard ditolak browser. Silakan tempel manual.");
  }
});

// 2. Ganti Tab Video / Audio
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedFormat = btn.dataset.type;

    if (selectedFormat === "video") {
      videoOptions.classList.remove("hidden");
      audioOptions.classList.add("hidden");
      downloadBtn.textContent = "Download Video ke HP";
    } else {
      videoOptions.classList.add("hidden");
      audioOptions.classList.remove("hidden");
      downloadBtn.textContent = "Download MP3 ke HP";
    }
  });
});

// 3. Proses Link TikTok
fetchBtn.addEventListener("click", async () => {
  const link = urlInput.value.trim();

  if (!link || !link.includes("tiktok.com")) {
    showError("Masukkan link TikTok yang valid (contoh: https://vt.tiktok.com/...)");
    return;
  }

  hideError();
  resultCard.classList.add("hidden");
  loader.classList.remove("hidden");
  fetchBtn.disabled = true;

  try {
    const response = await fetch(`${API_ENDPOINT}?url=${encodeURIComponent(link)}&hd=1`);
    const result = await response.json();

    if (result.code !== 0 || !result.data) {
      throw new Error(result.msg || "Video tidak ditemukan atau akun bersifat privat.");
    }

    currentMediaData = result.data;
    renderResult(currentMediaData);
  } catch (error) {
    showError(error.message || "Gagal mengambil data. Periksa koneksi internet.");
  } finally {
    loader.classList.add("hidden");
    fetchBtn.disabled = false;
  }
});

// 4. Tampilkan Pratinjau Video
function renderResult(data) {
  thumbImg.src = data.cover;
  authorName.textContent = `@${data.author.unique_id || data.author.nickname}`;
  videoTitle.textContent = data.title || "Video TikTok Tanpa Judul";
  musicTitle.textContent = data.music_info?.title
    ? `${data.music_info.title} - ${data.music_info.author || "TikTok Audio"}`
    : "Original Sound (MP3)";

  progressWrapper.classList.add("hidden");
  resultCard.classList.remove("hidden");
}

// 5. Eksekusi Download Langsung ke HP
downloadBtn.addEventListener("click", async () => {
  if (!currentMediaData) return;

  let downloadUrl = "";
  let fileExtension = "mp4";
  const videoId = currentMediaData.id || Date.now();

  if (selectedFormat === "audio") {
    downloadUrl = currentMediaData.music;
    fileExtension = "mp3";
  } else {
    const quality = document.querySelector('input[name="quality"]:checked').value;
    if (quality === "hd") {
      downloadUrl = currentMediaData.hdplay || currentMediaData.play;
    } else if (quality === "sd") {
      downloadUrl = currentMediaData.play;
    } else {
      downloadUrl = currentMediaData.wmplay || currentMediaData.play;
    }
    fileExtension = "mp4";
  }

  if (!downloadUrl) {
    showError("Link unduhan untuk kualitas ini tidak tersedia.");
    return;
  }

  const filename = `tiktok_${selectedFormat}_${videoId}.${fileExtension}`;
  await saveToPhone(downloadUrl, filename);
});

// Fungsi Download dengan Blob Stream + Progress Bar
async function saveToPhone(url, filename) {
  downloadBtn.disabled = true;
  progressWrapper.classList.remove("hidden");
  progressFill.style.width = "0%";
  progressText.textContent = "Menghubungkan...";

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Gagal mengunduh file.");

    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.length;

      if (total > 0) {
        const percent = Math.round((loaded / total) * 100);
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `Mengunduh: ${percent}%`;
      } else {
        progressText.textContent = `Mengunduh: ${(loaded / (1024 * 1024)).toFixed(1)} MB`;
      }
    }

    const blob = new Blob(chunks, {
      type: filename.endsWith(".mp3") ? "audio/mpeg" : "video/mp4",
    });

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    progressText.textContent = "Selesai! Tersimpan di folder Download HP.";
  } catch (err) {
    // Fallback jika server CDN memblokir fetch CORS
    progressText.textContent = "Membuka unduhan langsung...";
    window.open(url, "_blank");
  } finally {
    downloadBtn.disabled = false;
  }
}

function showError(msg) {
  statusMsg.textContent = msg;
  statusMsg.classList.remove("hidden");
}

function hideError() {
  statusMsg.classList.add("hidden");
}
