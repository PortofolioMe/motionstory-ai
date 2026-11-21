// =================================
// CONFIGURATION
// =================================

const DEFAULT_API_URL =
  "https://motionstory-api.ane-you1111.workers.dev";

let API_URL =
  localStorage.getItem("motionstory_api_url") || DEFAULT_API_URL;

let API_TOKEN =
  sessionStorage.getItem("motionstory_token") || "";

let projects = [];

// =================================
// API REQUEST
// =================================

async function apiRequest(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (API_TOKEN) {
    headers.Authorization = `Bearer ${API_TOKEN}`;
  }

  const response = await fetch(API_URL + endpoint, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Respons API bukan JSON yang valid.");
  }

  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Permintaan API gagal (${response.status})`);
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
// CONNECTION CHECK
// =================================

async function checkConnection() {
  try {
    const result = await apiRequest("/api/health");

    const online = result.database === true && result.ai === true;

    document.getElementById("apiStatus").textContent =
      online ? "Online" : "Periksa Backend";

    document.getElementById("connectionStatus").textContent =
      online ? "● Terhubung" : "● Perlu pemeriksaan";

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
           data-project-id="${escapeHTML(project.id)}"
           style="cursor:pointer">
        <h3>${escapeHTML(project.title)}</h3>
        <p>${escapeHTML(project.description || "Belum ada deskripsi")}</p>
      </div>
    `).join("")
    : "<p>Belum ada proyek.</p>";

  document.getElementById("recentProjects").innerHTML = html;
  document.getElementById("allProjects").innerHTML = html;

  document.querySelectorAll("[data-project-id]").forEach(card => {
    card.addEventListener("click", () => {
      openProject(card.dataset.projectId);
    });
  });
}

// =================================
// PAGE NAVIGATION
// =================================

function showPage(page) {
  const pages = [
    "dashboard",
    "generator",
    "projects",
    "settings"
  ];

  pages.forEach(name => {
    const element = document.getElementById(name + "Page");
    if (element) {
      element.classList.toggle("hidden", name !== page);
    }
  });

  const titles = {
    dashboard: "Dashboard",
    generator: "Generator AI",
    projects: "Semua Proyek",
    settings: "Pengaturan API"
  };

  document.getElementById("pageTitle").textContent =
    titles[page] || "Dashboard";

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });
}

// =================================
// CREATE MANUAL PROJECT
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

    let html = `
      <h2>${escapeHTML(project?.title || "Proyek")}</h2>
      <p>${scenes.length} adegan</p>
    `;

    if (scenes.length) {
      html += scenes.map(scene => `
        <article style="
          background:#fff;border:1px solid #e5e7eb;border-radius:12px;
          padding:16px;margin:12px 0
        ">
          <h3>Adegan ${escapeHTML(scene.scene_number)}:
            ${escapeHTML(scene.title || "")}</h3>
          <p><strong>Narasi:</strong><br>
            ${escapeHTML(scene.narration || "")}</p>
          <p><strong>Visual Prompt:</strong><br>
            ${escapeHTML(scene.visual_prompt || "")}</p>
          <p><strong>Sound Effect:</strong>
            ${escapeHTML(scene.sound_effect || "-")}</p>
          <p><strong>Musik:</strong>
            ${escapeHTML(scene.music || "-")}</p>
          <p><strong>Transisi:</strong>
            ${escapeHTML(scene.transition || "-")}</p>
          <p><strong>Durasi:</strong>
            ${escapeHTML(scene.duration || 8)} detik</p>
        </article>
      `).join("");
    } else {
      html += "<p>Belum ada adegan pada proyek ini.</p>";
    }

    document.getElementById("generatedResult").innerHTML = html;
    showPage("generator");

  } catch (error) {
    notify("Gagal membuka proyek: " + error.message);
  }
}

// =================================
// AI STORY GENERATOR
// =================================

async function generateStory() {
  const topicInput = document.getElementById("storyTopic");
  const durationInput = document.getElementById("storyDuration");
  const button = document.getElementById("generateStoryBtn");
  const message = document.getElementById("generatorMessage");
  const output = document.getElementById("generatedResult");

  const topic = topicInput.value.trim();
  const duration = Number(durationInput.value);

  if (!API_TOKEN) {
    message.textContent =
      "Masukkan API Token terlebih dahulu di Pengaturan API.";
    showPage("settings");
    return;
  }

  if (!topic) {
    message.textContent = "Silakan masukkan tema cerita terlebih dahulu.";
    topicInput.focus();
    return;
  }

  if (!Number.isInteger(duration) || duration < 30 || duration > 240) {
    message.textContent = "Durasi harus antara 30 sampai 240 detik.";
    return;
  }

  button.disabled = true;
  button.textContent = "Sedang membuat cerita...";
  message.textContent =
    "AI sedang menyusun cerita dan adegan. Mohon tunggu.";
  output.innerHTML = "";

  try {
    const result = await apiRequest("/api/ai/generate", {
      method: "POST",
      body: JSON.stringify({
        topic,
        duration_seconds: duration
      })
    });

    const project = result.project || result;
    const scenes = result.scenes || project.scenes || [];

    if (!scenes.length) {
      throw new Error(
        "AI memberikan respons, tetapi daftar adegan tidak ditemukan."
      );
    }

    message.textContent =
      `Berhasil! ${scenes.length} adegan telah dibuat dan disimpan.`;

    renderGeneratedStory(project, scenes);

    await loadProjects();

  } catch (error) {
    console.error("Generator AI error:", error);

    message.textContent =
      "Gagal membuat cerita: " + error.message;

  } finally {
    button.disabled = false;
    button.textContent = "✨ Buat Cerita dengan AI";
  }
}


// =================================
// RENDER GENERATED STORY
// =================================

function renderGeneratedStory(project, scenes) {
  const output = document.getElementById("generatedResult");

  const title = project.title || "Cerita Motivasi Baru";
  const description = project.description || "";

  output.innerHTML = `
    <div style="
      background:#171e32;
      color:#f4f6ff;
      border:1px solid #35415f;
      border-radius:16px;
      padding:22px;
      margin-bottom:20px;
    ">
      <p style="color:#54d5e8;font-size:12px;font-weight:700;letter-spacing:1px">
        HASIL GENERATOR AI
      </p>

      <h2 style="color:#ffffff;margin:10px 0">
        ${escapeHTML(title)}
      </h2>

      <p style="color:#cbd3e8;line-height:1.7">
        ${escapeHTML(description)}
      </p>

      <p style="color:#54d5e8">
        <strong>Total adegan:</strong> ${scenes.length}
      </p>
    </div>

    <h2 style="color:#ffffff;margin:25px 0 15px">
      Storyboard
    </h2>

    ${scenes.map((scene, index) => `
      <article style="
        background:#171e32;
        color:#f4f6ff;
        border:1px solid #35415f;
        border-radius:14px;
        padding:20px;
        margin:14px 0;
      ">

        <h3 style="color:#ffffff;margin-top:0">
          Adegan ${escapeHTML(scene.scene_number || index + 1)}:
          ${escapeHTML(scene.title || "Tanpa judul")}
        </h3>

        <p style="color:#54d5e8">
          <strong>Durasi:</strong>
          <span style="color:#ffffff">
            ${escapeHTML(scene.duration || 8)} detik
          </span>
        </p>

        <div style="
          background:#101628;
          border:1px solid #28314b;
          border-radius:10px;
          padding:15px;
          margin-top:14px;
        ">
          <strong style="color:#54d5e8">
            Narasi Bahasa Indonesia
          </strong>
          <p style="color:#f4f6ff;line-height:1.8;margin-bottom:0">
            ${escapeHTML(scene.narration || "-")}
          </p>
        </div>

        <div style="
          background:#101628;
          border:1px solid #28314b;
          border-radius:10px;
          padding:15px;
          margin-top:12px;
        ">
          <strong style="color:#54d5e8">
            Visual Prompt (English)
          </strong>
          <p style="color:#e0e6f5;line-height:1.8;margin-bottom:0">
            ${escapeHTML(scene.visual_prompt || "-")}
          </p>
        </div>

        <div style="
          background:#101628;
          border:1px solid #28314b;
          border-radius:10px;
          padding:15px;
          margin-top:12px;
        ">
          <strong style="color:#54d5e8">
            Sound Effect
          </strong>
          <p style="color:#e0e6f5;margin-bottom:0">
            ${escapeHTML(scene.sound_effect || "-")}
          </p>
        </div>

        <div style="
          background:#101628;
          border:1px solid #28314b;
          border-radius:10px;
          padding:15px;
          margin-top:12px;
        ">
          <strong style="color:#54d5e8">
            Music
          </strong>
          <p style="color:#e0e6f5;margin-bottom:0">
            ${escapeHTML(scene.music || "-")}
          </p>
        </div>

        <div style="
          background:#101628;
          border:1px solid #28314b;
          border-radius:10px;
          padding:15px;
          margin-top:12px;
        ">
          <strong style="color:#54d5e8">
            Transition
          </strong>
          <p style="color:#e0e6f5;margin-bottom:0">
            ${escapeHTML(scene.transition || "-")}
          </p>
        </div>

      </article>
    `).join("")}
  `;

  output.scrollIntoView({
    behavior: "smooth",
    block: "start"
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
        account.open_id ? "ID: " + account.open_id : "Akun terhubung";

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
      "Tidak dapat memeriksa akun TikTok. Periksa API Token.";

    button.textContent = "Coba Lagi";
    button.disabled = false;
    button.style.opacity = "1";
    button.style.cursor = "pointer";
  }
}

// =================================
// TIKTOK DISCONNECTED
// =================================

function showTikTokDisconnected() {
  const status = document.getElementById("tiktokStatus");
  const name = document.getElementById("tiktokDisplayName");
  const openId = document.getElementById("tiktokOpenId");
  const avatar = document.getElementById("tiktokAvatar");
  const placeholder = document.getElementById("tiktokAvatarPlaceholder");
  const message = document.getElementById("tiktokMessage");
  const button = document.getElementById("connectTikTokBtn");

  if (!status || !button) return;

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
    const urlInput = document.getElementById("apiUrl");
    const tokenInput = document.getElementById("apiToken");

    const newUrl = urlInput.value.trim().replace(/\/+$/, "");

    if (!newUrl) {
      notify("Masukkan API Base URL.");
      return;
    }

    try {
      new URL(newUrl);
    } catch {
      notify("Format API URL tidak valid.");
      return;
    }

    API_URL = newUrl;
    API_TOKEN = tokenInput.value.trim();

    localStorage.setItem("motionstory_api_url", API_URL);

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
  () => showPage("generator")
);

document.getElementById("createFirstProject").addEventListener(
  "click",
  () => showPage("generator")
);

document.getElementById("generateStoryBtn").addEventListener(
  "click",
  generateStory
);

document.getElementById("connectTikTokBtn").addEventListener(
  "click",
  connectTikTok
);

// =================================
// INITIALIZATION
// =================================

async function initializeApp() {
  document.getElementById("apiUrl").value = API_URL;
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
