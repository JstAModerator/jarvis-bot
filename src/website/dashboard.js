/* ========================================
   SERVER LOADING
======================================== */

async function loadServers() {
  try {
    const res = await fetch("/api/guilds");

    // Not logged in (or login expired): send them through Discord login
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!res.ok) {
      throw new Error("Failed to load servers");
    }

    const guilds = await res.json();

    const select = document.getElementById("serverSelect");

    select.innerHTML = `
      <option value="">Select a server...</option>
    `;

    guilds.forEach(guild => {
      const option = document.createElement("option");

      option.value = guild.id;
      option.textContent = guild.name;

      select.appendChild(option);
    });

  } catch (error) {
    console.error("Could not load servers:", error);
  }
}


/* ========================================
   SERVER SELECTION
======================================== */

document
  .getElementById("serverSelect")
  .addEventListener("change", async (event) => {

    const guildId = event.target.value;

    if (!guildId) {
      document.getElementById("serverName").textContent = "Not selected";
      document.getElementById("overviewServerName").textContent =
        "No server selected";

      return;
    }

    const selectedOption =
      event.target.options[event.target.selectedIndex];

    const serverName = selectedOption.textContent;

    document.getElementById("serverName").textContent = serverName;

    document.getElementById("overviewServerName").textContent =
      serverName;

    console.log("Selected guild:", guildId);

    try {

      const response =
        await fetch(`/api/settings/${guildId}`);

      if (!response.ok) {
        throw new Error("Failed to load server settings");
      }

      const settings = await response.json();

      applySettings(settings);
      await loadLogChannels(guildId);

    } catch (error) {
      console.error(
        "Could not load server settings:",
        error
      );
    }
  });


/* ========================================
   TAB SWITCHING
======================================== */

const tabs =
  document.querySelectorAll(".tab");

const panels =
  document.querySelectorAll(".panel");

const currentPage =
  document.getElementById("currentPage");


function openTab(target) {

  tabs.forEach(tab => {
    tab.classList.remove("active");
  });

  panels.forEach(panel => {
    panel.classList.remove("active");
  });

  const selectedTab =
    document.querySelector(
      `.tab[data-tab="${target}"]`
    );

  const selectedPanel =
    document.getElementById(target);

  if (!selectedPanel) {
    return;
  }

  if (selectedTab) {
    selectedTab.classList.add("active");
  }

  selectedPanel.classList.add("active");

  if (currentPage) {

    const name =
      selectedTab?.querySelector("span:last-child")
        ?.textContent || "Overview";

    currentPage.textContent = name;
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


tabs.forEach(tab => {

  tab.addEventListener("click", () => {

    openTab(tab.dataset.tab);

  });

});


/* ========================================
   OVERVIEW QUICK ACTIONS
======================================== */

document
  .querySelectorAll("[data-open-tab]")
  .forEach(button => {

    button.addEventListener("click", () => {

      openTab(button.dataset.openTab);

    });

  });


/* ========================================
   USER
======================================== */

async function loadUser() {

  try {

    const res =
      await fetch("/api/user");

    if (!res.ok) {
      throw new Error("Failed to load user");
    }

    const user =
      await res.json();

    const tag =
      user.discriminator
        ? `#${user.discriminator}`
        : "";

    const username =
      `${user.username}${tag}`;

    const userName =
      document.getElementById("userName");

    const welcomeUser =
      document.getElementById("welcomeUser");

    if (userName) {
      userName.textContent = username;
    }

    if (welcomeUser) {
      welcomeUser.textContent =
        user.username;
    }

  } catch (error) {

    console.error(
      "Could not load Discord user:",
      error
    );

  }

}


/* ========================================
   STATUS
======================================== */

const uptime = document.getElementById("uptime");
const ping = document.getElementById("ping");
const overviewUptime = document.getElementById("overviewUptime");
const overviewPing = document.getElementById("overviewPing");

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor(totalSeconds / 60) % 60;

  return days > 0
    ? `${days}d ${hours}h ${minutes}m`
    : `${hours}h ${minutes}m`;
}

async function loadStatus() {
  try {
    const res = await fetch("/api/status");

    if (!res.ok) {
      return;
    }

    const data = await res.json();

    const currentUptime = formatUptime(data.uptime_ms);
    const currentPing = data.ping >= 0 ? Math.round(data.ping) : "—";

    if (uptime) uptime.textContent = currentUptime;
    if (ping) ping.textContent = `${currentPing} ms`;
    if (overviewUptime) overviewUptime.textContent = currentUptime;
    if (overviewPing) overviewPing.textContent = currentPing;

  } catch (error) {
    console.error("Could not load status:", error);
  }
}


/* ========================================
   SETTINGS FORM (load + save)
======================================== */

const welcomeMessageInput = document.getElementById("welcomeMessage");
const embedColorInput = document.getElementById("embedColor");
const embedColorLabel = document.getElementById("embedColorLabel");
const logChannelSelect = document.getElementById("logChannel");
const memeSourceSelect = document.getElementById("memeSource");
const xpEnabledInput = document.getElementById("xpEnabled");
const economyEnabledInput = document.getElementById("economyEnabled");

function getGuildId() {
  return document.getElementById("serverSelect").value;
}

// Fills the form from /api/settings/:guildId
function applySettings(settings) {
  if (welcomeMessageInput) {
    welcomeMessageInput.value = settings.welcome_message || "";
  }

  if (embedColorInput && settings.embed_color) {
    embedColorInput.value = settings.embed_color;

    if (embedColorLabel) {
      embedColorLabel.textContent = settings.embed_color.toUpperCase();
    }
  }

  if (memeSourceSelect && settings.meme_source) {
    memeSourceSelect.value = settings.meme_source;
  }

  if (xpEnabledInput) xpEnabledInput.checked = !!settings.xp_enabled;
  if (economyEnabledInput) economyEnabledInput.checked = !!settings.economy_enabled;
}

// Briefly shows a message on a button instead of using alert()
function flashButton(button, text) {
  if (!button.dataset.label) {
    button.dataset.label = button.textContent;
  }

  button.textContent = text;
  button.disabled = true;

  setTimeout(() => {
    button.textContent = button.dataset.label;
    button.disabled = false;
  }, 1600);
}

function onClick(id, handler) {
  const element = document.getElementById(id);

  if (element) {
    element.addEventListener("click", () => handler(element));
  }
}

async function postSettings(button, payload) {
  const guildId = getGuildId();

  if (!guildId) {
    return flashButton(button, "Select a server first");
  }

  try {
    const res = await fetch(`/api/update-settings/${guildId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return flashButton(button, data.error || "Failed to save");
    }

    flashButton(button, "Saved ✓");
  } catch (error) {
    console.error("Could not save settings:", error);
    flashButton(button, "Failed to save");
  }
}

onClick("saveWelcome", (button) =>
  postSettings(button, { welcome_message: welcomeMessageInput.value })
);

onClick("saveColor", (button) =>
  postSettings(button, { embed_color: embedColorInput.value })
);

onClick("saveMemeSource", (button) =>
  postSettings(button, { meme_source: memeSourceSelect.value })
);

onClick("saveSystems", (button) =>
  postSettings(button, {
    xp_enabled: xpEnabledInput.checked,
    economy_enabled: economyEnabledInput.checked,
  })
);

if (embedColorInput && embedColorLabel) {
  embedColorInput.addEventListener("input", () => {
    embedColorLabel.textContent = embedColorInput.value.toUpperCase();
  });
}


/* ========================================
   LOG CHANNEL
======================================== */

async function loadLogChannels(guildId) {
  if (!logChannelSelect) return;

  logChannelSelect.innerHTML = `<option value="">Logging disabled</option>`;

  try {
    const [channelsRes, modlogRes] = await Promise.all([
      fetch(`/api/channels/${guildId}`),
      fetch(`/api/modlog/${guildId}`),
    ]);

    if (!channelsRes.ok || !modlogRes.ok) {
      throw new Error("Failed to load log channels");
    }

    const channels = await channelsRes.json();
    const modlog = await modlogRes.json();

    channels.forEach((channel) => {
      const option = document.createElement("option");

      option.value = channel.id;
      option.textContent = `# ${channel.name}`;

      logChannelSelect.appendChild(option);
    });

    logChannelSelect.value = modlog.channel_id || "";
  } catch (error) {
    console.error("Could not load log channels:", error);
  }
}

onClick("saveLogChannel", async (button) => {
  const guildId = getGuildId();

  if (!guildId) {
    return flashButton(button, "Select a server first");
  }

  try {
    const res = await fetch(`/api/modlog/${guildId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id: logChannelSelect.value || null }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return flashButton(button, data.error || "Failed to save");
    }

    flashButton(button, "Saved ✓");
  } catch (error) {
    console.error("Could not save log channel:", error);
    flashButton(button, "Failed to save");
  }
});


/* ========================================
   INITIALIZE
======================================== */

loadServers();
loadUser();
loadStatus();
setInterval(loadStatus, 30000);