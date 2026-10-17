/* ========================================
   SERVER LOADING
======================================== */

async function loadServers() {
  try {
    const res = await fetch("/api/guilds");

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

      const welcomeMessage =
        document.querySelector(
          "#server-settings textarea"
        );

      const embedColor =
        document.querySelector(
          "#server-settings input[type=color]"
        );

      if (welcomeMessage) {
        welcomeMessage.value =
          settings.welcome_message || "";
      }

      if (embedColor && settings.embed_color) {
        embedColor.value =
          settings.embed_color;
      }

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

const uptime =
  document.getElementById("uptime");

const ping =
  document.getElementById("ping");

const overviewUptime =
  document.getElementById("overviewUptime");

const overviewPing =
  document.getElementById("overviewPing");


/*
  These remain placeholders until your backend
  provides real uptime and ping values.
*/

const currentUptime = "3h 21m";
const currentPing = "42";

if (uptime) {
  uptime.textContent =
    currentUptime;
}

if (ping) {
  ping.textContent =
    `${currentPing} ms`;
}

if (overviewUptime) {
  overviewUptime.textContent =
    currentUptime;
}

if (overviewPing) {
  overviewPing.textContent =
    currentPing;
}


/* ========================================
   INITIALIZE
======================================== */

loadServers();
loadUser();