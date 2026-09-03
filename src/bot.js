import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

dotenv.config();

// Resolve directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ============================================================
   DATABASE (SERVER SETTINGS)
   ============================================================ */

const db = new Database(path.join(__dirname, "database", "settings.db"));

db.prepare(`
  CREATE TABLE IF NOT EXISTS server_settings (
    guild_id TEXT PRIMARY KEY,
    embed_color TEXT DEFAULT '#6a4cff',
    welcome_message TEXT DEFAULT 'Welcome to the server!',
    meme_source TEXT DEFAULT 'default'
  )
`).run();

function getSettings(guildId) {
  return db.prepare(`SELECT * FROM server_settings WHERE guild_id = ?`).get(guildId);
}

function createDefaultSettings(guildId) {
  db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(guildId);
}

function updateSetting(guildId, key, value) {
  db.prepare(`UPDATE server_settings SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
}

/* ============================================================
   EXPRESS SERVER (Dashboard + OAuth)
   ============================================================ */

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "website")));

app.use(
  session({
    secret: "jarvis-dashboard-secret",
    resave: false,
    saveUninitialized: false,
  })
);

/* ------------------------------
   WEBSITE ROUTES
------------------------------ */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "index.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "dashboard.html"));
});

app.get("/tos", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "tos.html"));
});

app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "privacy.html"));
});

/* ------------------------------
   DISCORD OAUTH CALLBACK
------------------------------ */

app.get("/auth/discord", async (req, res) => {
  const code = req.query.code;

  if (!code) return res.send("Missing ?code");

  try {
    const tokenData = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://jarvis-bot-fod2.onrender.com/auth/discord",
      }),
    }).then((r) => r.json());

    req.session.access_token = tokenData.access_token;

    res.redirect("/dashboard");
  } catch (err) {
    console.error("OAuth error:", err);
    res.send("OAuth failed.");
  }
});

/* ------------------------------
   API: Fetch user's servers
------------------------------ */

app.get("/api/guilds", async (req, res) => {
  try {
    const token = req.session.access_token;
    if (!token) return res.json([]);

    const guilds = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    res.json(guilds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch guilds" });
  }
});

/* ------------------------------
   API: Load settings for a server
------------------------------ */

app.get("/api/settings/:guildId", (req, res) => {
  const guildId = req.params.guildId;
  const settings = getSettings(guildId);
  res.json(settings || {});
});

/* ------------------------------
   API: Update settings
------------------------------ */
// Fetch logged‑in user info
app.get("/api/user", async (req, res) => {
  const token = req.session.access_token;
  if (!token) return res.json({ username: "Unknown" });

  try {
    const user = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json());

    res.json(user);
  } catch (err) {
    console.error("Failed to fetch user:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

app.post("/api/update-settings/:guildId", (req, res) => {
  const guildId = req.params.guildId;
  const { embed_color, welcome_message, meme_source } = req.body;

  try {
    if (embed_color) updateSetting(guildId, "embed_color", embed_color);
    if (welcome_message) updateSetting(guildId, "welcome_message", welcome_message);
    if (meme_source) updateSetting(guildId, "meme_source", meme_source);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* ------------------------------
   KEEP-ALIVE (Render)
------------------------------ */

app.listen(PORT, () => {
  console.log(`Dashboard + Bot server running on port ${PORT}`);
});

setInterval(() => {
  fetch("https://jarvis-bot-fod2.onrender.com")
    .then(() => console.log("Keep-alive ping sent"))
    .catch(() => console.log("Keep-alive ping failed"));
}, 240000);

/* ============================================================
   DISCORD BOT CLIENT
   ============================================================ */

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.on("guildCreate", (guild) => {
  createDefaultSettings(guild.id);
  console.log(`Created settings for ${guild.name}`);
});

async function onReady() {
  console.log(`Logged in as ${client.user.tag}`);

  client.commands = new Map();

  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs.readdirSync(commandsPath).filter((file) =>
    file.endsWith(".js")
  );

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(filePath);

    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command.execute);
      console.log(`✔ Loaded command: ${command.data.name}`);
    } else {
      console.log(`⚠ Skipped ${file} — missing data or execute`);
    }
  }

  console.log("✅ Bot startup complete (commands loaded)");
}

client.once("clientReady", onReady);

/* ============================================================
   INTERACTION HANDLER
   ============================================================ */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const executor = client.commands.get(interaction.commandName);
  if (!executor) {
    return interaction.reply({
      content: "Command not found.",
      ephemeral: true,
    });
  }

  try {
    await executor(interaction);
  } catch (error) {
    console.error(error);
    try {
      await interaction.reply({
        content: "Error executing command.",
        ephemeral: true,
      });
    } catch {}
  }
});

/* ============================================================
   LOGIN
   ============================================================ */

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("❌ Failed to login to Discord:", err);
  process.exit(1);
});
