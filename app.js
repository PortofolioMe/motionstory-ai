
const API_URL = "https://motionstory-api.ane-you1111.workers.dev";

let API_TOKEN = sessionStorage.getItem("motionstory_token") || "";
let projects = [];

// =================================
// API REQUEST
// =================================

async function apiRequest(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (API_TOKEN) {
    headers["Authorization"] = `Bearer ${API_TOKEN}`;
  }

  const response = await fetch(API_URL + endpoint, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  const result = await response.json();

  if (!response.ok || result.ok === false) {
    throw new Error(result.error || "Permintaan API gagal");
  }

  return result;
}

// =================================
// NOTIFICATION
// =================================

function notify(message) {
  alert(message);
}

// =================================
// CONNECTION CHECK
// =================================

async function checkConnection() {
  try {
    const result = await apiRequest("/api/health");

    document.getElementById("apiStatus").textContent =
      result.database ? "Online" : "Database Error";

    document.getElementById("connectionStatus").textContent =
      result.database
        ? "● Terhubung"
        : "● Database bermasalah";

    return true;

  } catch (error) {
    document.getElementById("apiStatus").textContent = "Offline";

    document.getElementById("connectionStatus").textContent =
      "● Tidak terhubung";

    console.error(error);
    return false;
  }
}

// =================================
// LOAD PROJECTS
// =================================

async function loadProjects() {
  try {
    const result = await apiRequest("/api/projects");

    projects = result.projects || [];

    renderProjects();

  } catch (error) {
    console.error("Gagal memuat proyek:", error);

    document.getElementById("recentProjects").innerHTML =
      "<p>Gagal memuat proyek. Periksa koneksi API dan token.</p>";

    document.getElementById("allProjects").innerHTML =
      "<p>Gagal memuat proyek.</p>";
  }
}

// =================================
// RENDER PROJECTS
// =================================

function renderProjects() {
  document.getElementById("totalProjects").textContent =
    projects.length;

  const html = projects.length
    ? projects.map(project => `
      <div class="project-card"
           onclick="openProject('${escapeHTML(project.id)}')">

        <h3>${escapeHTML(project.title)}</h3>

        <p>${escapeHTML(project.description || "Belum ada deskripsi")}</p>

      </div>
    `).join("")
    : "<p>Belum ada proyek.</p>";

  document.getElementById("recentProjects").innerHTML = html;
  document.getElementById("allProjects").innerHTML = html;
}

// =================================
// HTML ESCAPE
// =================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// =================================
// CREATE PROJECT
// =================================

async function createProject() {
  const title = prompt("Masukkan judul proyek:");

  if (!title || !title.trim()) return;

  const description = prompt("Masukkan deskripsi proyek:") || "";

  try {
    await apiRequest("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim()
      })
    });

    notify("Proyek berhasil dibuat!");
    await loadProjects();

  } catch (error) {
    notify("Gagal membuat proyek: " + error.message);
  }
}

// =================================
// OPEN PROJECT
// =================================

async function openProject(id) {
  try {
    const result = await apiRequest(
      `/api/projects/${encodeURIComponent(id)}/scenes`
    );

    const scenes = result.scenes || [];

    document.getElementById("totalScenes").textContent =
      scenes.length;

    const project = projects.find(
      item => String(item.id) === String(id)
    );

    alert(
      "PROYEK: " + (project?.title || "MOTIONSTORY AI") +
      "\nJumlah adegan: " + scenes.length
    );

  } catch (error) {
    notify("Gagal membuka proyek: " + error.message);
  }
}

// =================================
// PAGE NAVIGATION
// =================================

function showPage(page) {
  const pages = [
    "dashboard",
    "projects",
    "settings"
  ];

  pages.forEach(name => {
    const element = document.getElementById(name + "Page");

    element.classList.toggle("hidden", name !== page);
  });

  document.getElementById("pageTitle").textContent =
    page === "dashboard"
      ? "Dashboard"
      : page === "projects"
      ? "Semua Proyek"
      : "Pengaturan API";

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });
}

// =================================
// TIKTOK STATUS
// =================================

async function loadTikTokStatus() {
  const status = document.getElementById("tiktokStatus");
  const name = document.getElementById("tiktokDisplayName");
  const openId = document.getElementById("tiktokOpenId");
  const avatar = document.getElementById("tiktokAvatar");
  const placeholder = document.getElementById("tiktokAvatarPlaceholder");
  const message = document.getElementById("tiktokMessage");
  const button = document.getElementById("connectTikTokBtn");

  if (!status || !name || !button) return;

  status.textContent = "Memeriksa...";
  button.disabled = true;

  try {
    const result = await apiRequest("/api/tiktok/status");

    if (result.connected && result.account) {
      const account = result.account;

      status.textContent = "● Terhubung";
      status.style.background = "#dcfce7";
      status.style.color = "#166534";

      name.textContent =
        account.display_name || "Akun TikTok terhubung";

      openId.textContent =
        account.open_id
          ? "ID: " + account.open_id
          : "Akun TikTok berhasil terhubung";

      if (account.avatar_url) {
        avatar.src = account.avatar_url;
        avatar.style.display = "block";
        placeholder.style.display = "none";

        avatar.onerror = () => {
          avatar.style.display = "none";
          placeholder.style.display = "flex";
        };
      } else {
        avatar.style.display = "none";
        placeholder.style.display = "flex";
      }

      message.textContent =
        "Akun TikTok Anda berhasil terhubung dengan MOTIONSTORY AI.";

      button.textContent = "TikTok Sudah Terhubung";
      button.disabled = true;
      button.style.opacity = "0.65";
      button.style.cursor = "not-allowed";

    } else {
      showTikTokDisconnected();
    }

  } catch (error) {
    console.error("Gagal memeriksa TikTok:", error);

    status.textContent = "Belum terhubung";
    status.style.background = "#fef3c7";
    status.style.color = "#92400e";

    message.textContent =
      "Tidak dapat memeriksa akun TikTok. Pastikan API Token sudah benar.";

    button.textContent = "Coba Lagi";
    button.disabled = false;
    button.style.opacity = "1";
    button.style.cursor = "pointer";
  }
}

// =================================
// TIKTOK DISCONNECTED DISPLAY
// =================================

function showTikTokDisconnected() {
  const status = document.getElementById("tiktokStatus");
  const name = document.getElementById("tiktokDisplayName");
  const openId = document.getElementById("tiktokOpenId");
  const avatar = document.getElementById("tiktokAvatar");
  const placeholder = document.getElementById("tiktokAvatarPlaceholder");
  const message = document.getElementById("tiktokMessage");
  const button = document.getElementById("connectTikTokBtn");

  status.textContent = "Belum terhubung";
  status.style.background = "#fef3c7";
  status.style.color = "#92400e";

  name.textContent = "Belum ada akun terhubung";
  openId.textContent = "Hubungkan akun TikTok Anda";

  avatar.style.display = "none";
  placeholder.style.display = "flex";

  message.textContent =
    "Hubungkan akun TikTok untuk mengintegrasikannya dengan MOTIONSTORY AI.";

  button.textContent = "Hubungkan TikTok";
  button.disabled = false;
  button.style.opacity = "1";
  button.style.cursor = "pointer";
}

// =================================
// CONNECT TIKTOK
// =================================

async function connectTikTok() {
  const button = document.getElementById("connectTikTokBtn");
  const message = document.getElementById("tiktokMessage");

  if (!API_TOKEN) {
    notify("Masukkan API Token terlebih dahulu di Pengaturan API.");
    showPage("settings");
    return;
  }

  try {
    button.disabled = true;
    button.textContent = "Menghubungkan...";
    message.textContent = "Menyiapkan koneksi TikTok...";

    const result = await apiRequest("/api/tiktok/auth", {
      method: "POST",
      body: JSON.stringify({})
    });

    if (!result.auth_url) {
      throw new Error("URL otorisasi TikTok tidak ditemukan.");
    }

    window.location.href = result.auth_url;

  } catch (error) {
    console.error("Gagal menghubungkan TikTok:", error);

    notify("Gagal menghubungkan TikTok: " + error.message);

    button.disabled = false;
    button.textContent = "Hubungkan TikTok";
    message.textContent = "Koneksi TikTok belum berhasil dimulai.";
  }
}

// =================================
// SAVE API SETTINGS
// =================================

document.getElementById("saveSettings").addEventListener(
  "click",
  async function() {
    API_TOKEN = document.getElementById("apiToken").value.trim();

    if (API_TOKEN) {
      sessionStorage.setItem("motionstory_token", API_TOKEN);
    } else {
      sessionStorage.removeItem("motionstory_token");
    }

    const connected = await checkConnection();

    document.getElementById("settingsMessage").textContent =
      connected
        ? "Koneksi API berhasil."
        : "Koneksi gagal. Periksa token dan konfigurasi API.";

    if (connected) {
      await loadProjects();
      await loadTikTokStatus();
    }
  }
);

// =================================
// BUTTON EVENTS
// =================================

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

document.getElementById("newProjectBtn").addEventListener(
  "click",
  createProject
);

document.getElementById("createFirstProject").addEventListener(
  "click",
  createProject
);

document.getElementById("connectTikTokBtn").addEventListener(
  "click",
  connectTikTok
);

// =================================
// INITIALIZATION
// =================================

async function initializeApp() {
  document.getElementById("apiToken").value = API_TOKEN;

  const connected = await checkConnection();

  if (connected) {
    await loadProjects();
    await loadTikTokStatus();
  } else {
    showTikTokDisconnected();
  }
}

initializeApp();
