async function loadServers() {
  const res = await fetch("/api/guilds");
  const guilds = await res.json();

  const select = document.getElementById("serverSelect");

  guilds.forEach(g => {
    const option = document.createElement("option");
    option.value = g.id;
    option.textContent = g.name;
    select.appendChild(option);
  });
}

loadServers();
document.getElementById("serverSelect").addEventListener("change", async (e) => {
  const guildId = e.target.value;

  console.log("Selected guild:", guildId);

  // Load settings for that server
  const settings = await fetch(`/api/settings/${guildId}`).then(r => r.json());

  // Fill UI fields
  document.querySelector("#server-settings textarea").value = settings.welcome_message;
  document.querySelector("#server-settings input[type=color]").value = settings.embed_color;
});

// Tab switching
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(target).classList.add('active');
  });
});

async function loadUser() {
  const res = await fetch("/api/user");
  const user = await res.json();

  document.getElementById("userName").textContent =
    `${user.username}#${user.discriminator}`;
}

loadUser();
document.getElementById('uptime').textContent = '3h 21m';
document.getElementById('ping').textContent = '42';

// TODO: After OAuth, fetch guilds and populate serverSelect
// fetch('/api/guilds').then(...).then(guilds => { ... });
