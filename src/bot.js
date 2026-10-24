import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { loadCommands } from "./handlers/commandLoader.js";
import { deployCommands } from "./deploy-commands.js";
import { registerXpHandlers } from "./handlers/xpHandler.js";

dotenv.config();

// Log errors instead of letting them vanish silently
process.on("unhandledRejection", (error) => {
  console.error("UNHANDLED REJECTION:", error);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

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

// Make sure xp_enabled / economy_enabled exist even if /settings
// hasn't been run yet (the dashboard can now save these).
const settingsColumns = db
  .prepare(`PRAGMA table_info(server_settings)`)
  .all()
  .map((col) => col.name);

if (!settingsColumns.includes("xp_enabled")) {
  db.prepare(`ALTER TABLE server_settings ADD COLUMN xp_enabled INTEGER DEFAULT 1`).run();
}

if (!settingsColumns.includes("economy_enabled")) {
  db.prepare(`ALTER TABLE server_settings ADD COLUMN economy_enabled INTEGER DEFAULT 1`).run();
}

function getSettings(guildId) {
  return db.prepare(`SELECT * FROM server_settings WHERE guild_id = ?`).get(guildId);
}

function createDefaultSettings(guildId) {
  db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(guildId);
}

// Only known column names are allowed, since the key is placed
// directly into the SQL string.
const ALLOWED_SETTINGS = new Set([
  "embed_color",
  "welcome_message",
  "meme_source",
  "xp_enabled",
  "economy_enabled",
]);

function updateSetting(guildId, key, value) {
  if (!ALLOWED_SETTINGS.has(key)) {
    throw new Error(`Invalid setting: ${key}`);
  }

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
    secret: process.env.SESSION_SECRET || "jarvis-dashboard-secret",
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
   DASHBOARD AUTH HELPERS
------------------------------ */

const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

// Fetches the logged-in user's guilds from Discord, cached in the
// session for 60s so we don't hit Discord's rate limits.
async function getUserGuilds(req) {
  const token = req.session.access_token;
  if (!token) return null;

  const cached = req.session.guildCache;
  if (cached && Date.now() - cached.at < 60000) return cached.data;

  const response = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (!Array.isArray(data)) return null;

  req.session.guildCache = { at: Date.now(), data };
  return data;
}

function canManage(guild) {
  if (guild.owner) return true;

  const perms = BigInt(guild.permissions);
  return (
    (perms & MANAGE_GUILD) === MANAGE_GUILD ||
    (perms & ADMINISTRATOR) === ADMINISTRATOR
  );
}

// Blocks the request unless the user manages this server AND Jarvis is in it.
async function requireGuildAccess(req, res, next) {
  try {
    const guilds = await getUserGuilds(req);

    if (!guilds) {
      return res.status(401).json({ error: "Not logged in." });
    }

    const guild = guilds.find((g) => g.id === req.params.guildId);

    if (!guild || !canManage(guild)) {
      return res.status(403).json({ error: "You don't manage that server." });
    }

    if (!client.guilds.cache.has(req.params.guildId)) {
      return res.status(404).json({ error: "Jarvis isn't in that server." });
    }

    next();
  } catch (error) {
    console.error("GUILD ACCESS ERROR:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
}

/* ------------------------------
   API: Servers the user can manage (and Jarvis is in)
------------------------------ */

app.get("/api/guilds", async (req, res) => {
  try {
    const guilds = await getUserGuilds(req);
    if (!guilds) return res.json([]);

    const usable = guilds
      .filter((g) => canManage(g) && client.guilds.cache.has(g.id))
      .map((g) => ({ id: g.id, name: g.name, icon: g.icon }));

    res.json(usable);
  } catch (error) {
    console.error("GUILDS ERROR:", error);
    res.status(500).json({ error: "Failed to fetch guilds" });
  }
});

/* ------------------------------
   API: Load settings for a server
------------------------------ */

app.get("/api/settings/:guildId", requireGuildAccess, (req, res) => {
  const guildId = req.params.guildId;

  createDefaultSettings(guildId);
  res.json(getSettings(guildId));
});

/* ------------------------------
   API: Current user
------------------------------ */

app.get("/api/user", async (req, res) => {
  const token = req.session.access_token;
  if (!token) return res.json({ username: "Unknown" });

  try {
    const user = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    const displayName = user.global_name || user.username;
    const tag = user.discriminator ? `#${user.discriminator}` : "";

    res.json({ username: displayName, discriminator: user.discriminator, tag });
  } catch (err) {
    console.error("Failed to fetch user:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

/* ------------------------------
   API: Update settings
------------------------------ */

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MEME_SOURCES = ["default", "reddit", "imgur", "tenor"];

app.post("/api/update-settings/:guildId", requireGuildAccess, (req, res) => {
  const guildId = req.params.guildId;
  const { embed_color, welcome_message, meme_source, xp_enabled, economy_enabled } = req.body;

  const updates = {};

  if (embed_color !== undefined) {
    if (typeof embed_color !== "string" || !HEX_COLOR.test(embed_color)) {
      return res.status(400).json({ error: "Embed color must be a hex code like #6a4cff." });
    }
    updates.embed_color = embed_color;
  }

  if (welcome_message !== undefined) {
    if (
      typeof welcome_message !== "string" ||
      welcome_message.trim().length === 0 ||
      welcome_message.length > 1000
    ) {
      return res.status(400).json({ error: "Welcome message must be 1–1000 characters." });
    }
    updates.welcome_message = welcome_message;
  }

  if (meme_source !== undefined) {
    if (!MEME_SOURCES.includes(meme_source)) {
      return res.status(400).json({ error: "Invalid meme source." });
    }
    updates.meme_source = meme_source;
  }

  if (xp_enabled !== undefined) {
    updates.xp_enabled = xp_enabled ? 1 : 0;
  }

  if (economy_enabled !== undefined) {
    updates.economy_enabled = economy_enabled ? 1 : 0;
  }

  try {
    createDefaultSettings(guildId);

    const applyAll = db.transaction((entries) => {
      for (const [key, value] of entries) {
        updateSetting(guildId, key, value);
      }
    });

    applyAll(Object.entries(updates));

    res.json({ success: true, settings: getSettings(guildId) });
  } catch (error) {
    console.error("UPDATE SETTINGS ERROR:", error);
    res.status(500).json({ success: false, error: "Failed to save settings." });
  }
});

/* ------------------------------
   API: Live bot status
------------------------------ */

app.get("/api/status", (req, res) => {
  if (!req.session.access_token) {
    return res.status(401).json({ error: "Not logged in." });
  }

  res.json({
    uptime_ms: client.uptime ?? 0,
    ping: client.ws.ping,
    guilds: client.guilds.cache.size,
  });
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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.on("guildCreate", (guild) => {
  createDefaultSettings(guild.id);
  console.log(`Created settings for ${guild.name}`);
});

async function onReady() {
  console.log(`Logged in as ${client.user.tag}`);

  await deployCommands();
  await loadCommands(client);
  registerXpHandlers(client);

  console.log("✅ Bot startup complete (commands loaded + deployed)");
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
    await executor.execute(interaction);
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