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
let selectedFormat = "video";

// 1. Tombol Tempel Clipboard
pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      hideError();
    }
  } catch (err) {
    showError("Izin clipboard ditolak. Silakan tempel link secara manual.");
  }
});

// 2. Tab Video / Audio
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

// 3. Ambil Metadata Video
fetchBtn.addEventListener("click", async () => {
  const link = urlInput.value.trim();

  if (!link || !link.includes("tiktok.com")) {
    showError("Masukkan link TikTok yang valid.");
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
      throw new Error(result.msg || "Video tidak ditemukan atau akun privat.");
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

// 4. Tombol Download
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

// 5. Unduh & Simpan ke Galeri Android
async function saveToPhone(url, filename) {
  downloadBtn.disabled = true;
  hideError();
  progressWrapper.classList.remove("hidden");
  progressFill.style.width = "20%";
  progressText.textContent = "Mengunduh dari server TikTok...";

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Gagal mengunduh media.");

    progressFill.style.width = "60%";
    const blob = await response.blob();
    const mimeType = filename.endsWith(".mp3") ? "audio/mpeg" : "video/mp4";

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.MediaSaver) {
      progressFill.style.width = "85%";
      progressText.textContent = "Menyimpan ke Galeri...";

      const base64Data = await blobToBase64(blob);
      const res = await window.Capacitor.Plugins.MediaSaver.saveMedia({
        base64Data,
        fileName: filename,
        mimeType,
      });

      progressFill.style.width = "100%";
      progressText.textContent = `Tersimpan di Galeri (${res.folder}/${filename})`;
    } else {
      // Fallback jika dibuka di browser biasa
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

      progressFill.style.width = "100%";
      progressText.textContent = "Selesai! Tersimpan di folder Download.";
    }
  } catch (err) {
    showError("Gagal menyimpan: " + (err.message || err));
    progressWrapper.classList.add("hidden");
  } finally {
    downloadBtn.disabled = false;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
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
