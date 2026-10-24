import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from "discord.js";
import dotenv from "dotenv";
import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { loadCommands } from "./handlers/commandLoader.js";
import { deployCommands } from "./deploy-commands.js";
import { registerXpHandlers } from "./handlers/xpHandler.js";
import { db as modlogDb, getModlogChannel } from "./database/moderation.js";

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

// The dashboard page requires login, so block direct access to the raw file.
app.get("/dashboard.html", (req, res) => res.redirect("/dashboard"));

app.use(express.static(path.join(__dirname, "website")));

/* ------------------------------
   LOGIN SESSIONS (encrypted cookie, no server storage)
   The cookie holds the user's Discord tokens, encrypted with
   SESSION_SECRET, so logins survive restarts and redeploys.
------------------------------ */

const SESSION_COOKIE = "jarvis_session";
const STATE_COOKIE = "jarvis_oauth_state";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // stay logged in for 30 days
const REDIRECT_URI = "https://jarvis-bot-fod2.onrender.com/auth/discord";
const SECURE_COOKIES = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET) {
  console.warn("⚠️ SESSION_SECRET is not set — logins will NOT survive a restart. Set it in Render.");
}

const SESSION_KEY = crypto
  .createHash("sha256")
  .update(process.env.SESSION_SECRET || crypto.randomBytes(32))
  .digest();

function encryptSession(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", SESSION_KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function decryptSession(value) {
  try {
    const buffer = Buffer.from(value, "base64url");

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      SESSION_KEY,
      buffer.subarray(0, 12)
    );
    decipher.setAuthTag(buffer.subarray(12, 28));

    const decrypted = Buffer.concat([
      decipher.update(buffer.subarray(28)),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }

  return null;
}

// Returns the logged-in session, or null if missing / tampered / older than 30 days
function getSession(req) {
  const raw = readCookie(req, SESSION_COOKIE);
  if (!raw) return null;

  const session = decryptSession(raw);
  if (!session || !session.refresh_token) return null;
  if (Date.now() - session.created_at > SESSION_MAX_AGE_MS) return null;

  return session;
}

function saveSession(res, session) {
  res.cookie(SESSION_COOKIE, encryptSession(session), {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS,
  });
}

// Trades a refresh token for a new access token. Shared between
// simultaneous requests so the same refresh token isn't used twice.
const refreshing = new Map();

function refreshSession(session) {
  if (!refreshing.has(session.refresh_token)) {
    const attempt = (async () => {
      try {
        const response = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: "refresh_token",
            refresh_token: session.refresh_token,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.access_token) return null;

        return {
          ...session,
          access_token: data.access_token,
          refresh_token: data.refresh_token || session.refresh_token,
          expires_at: Date.now() + data.expires_in * 1000,
        };
      } catch (error) {
        console.error("TOKEN REFRESH ERROR:", error);
        return null;
      }
    })().finally(() => refreshing.delete(session.refresh_token));

    refreshing.set(session.refresh_token, attempt);
  }

  return refreshing.get(session.refresh_token);
}

// Returns a valid Discord access token for this request, refreshing it if needed
async function getAccessToken(req, res) {
  const session = getSession(req);
  if (!session) return null;

  if (session.expires_at - Date.now() > 60000) {
    return session.access_token;
  }

  const refreshed = await refreshSession(session);
  if (!refreshed) return null;

  saveSession(res, refreshed);
  return refreshed.access_token;
}

/* ------------------------------
   WEBSITE ROUTES
------------------------------ */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "index.html"));
});

app.get("/dashboard", (req, res) => {
  if (!getSession(req)) return res.redirect("/login");

  res.sendFile(path.join(__dirname, "website", "dashboard.html"));
});

app.get("/tos", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "tos.html"));
});

app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "privacy.html"));
});

/* ------------------------------
   DISCORD LOGIN
------------------------------ */

app.get("/login", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");

  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "identify guilds",
    state,
  });

  // If they've approved Jarvis before, skip Discord's "Authorize" screen.
  // If they haven't, Discord returns an error and we retry with ?consent=1.
  if (req.query.consent !== "1") {
    params.set("prompt", "none");
  }

  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get("/auth/discord", async (req, res) => {
  const { code, state, error } = req.query;
  const expectedState = readCookie(req, STATE_COOKIE);

  res.clearCookie(STATE_COOKIE);

  // Missing / mismatched state (expired login, or an old direct link): start over
  if (!state || !expectedState || state !== expectedState) {
    return res.redirect("/login");
  }

  if (error) {
    // Never approved before (prompt=none) -> show the full authorize screen.
    // The user pressed Cancel -> back to the front page.
    return res.redirect(error === "access_denied" ? "/" : "/login?consent=1");
  }

  if (!code) return res.redirect("/login");

  try {
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await response.json();

    if (!response.ok || !tokenData.access_token || !tokenData.refresh_token) {
      console.error("OAuth token exchange failed:", tokenData);
      return res.send("Discord login failed. Please try again.");
    }

    saveSession(res, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
      created_at: Date.now(),
    });

    res.redirect("/dashboard");
  } catch (err) {
    console.error("OAuth error:", err);
    res.send("OAuth failed.");
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.redirect("/");
});

/* ------------------------------
   DASHBOARD AUTH HELPERS
------------------------------ */

const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

// Short-lived server-side cache so we don't hit Discord's rate limits
const guildCache = new Map();

async function getUserGuilds(req, res) {
  const token = await getAccessToken(req, res);
  if (!token) return null;

  const cached = guildCache.get(token);
  if (cached && Date.now() - cached.at < 60000) return cached.data;

  const response = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (!Array.isArray(data)) return null;

  if (guildCache.size > 500) guildCache.clear();
  guildCache.set(token, { at: Date.now(), data });

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
    const guilds = await getUserGuilds(req, res);

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
    const guilds = await getUserGuilds(req, res);
    if (!guilds) return res.status(401).json({ error: "Not logged in." });

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
  const token = await getAccessToken(req, res);
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
   API: Text channels Jarvis can post in
------------------------------ */

app.get("/api/channels/:guildId", requireGuildAccess, (req, res) => {
  const guild = client.guilds.cache.get(req.params.guildId);
  const me = guild.members.me;

  const channels = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildText)
    .filter((c) =>
      c.permissionsFor(me)?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
      ])
    )
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((c) => ({ id: c.id, name: c.name }));

  res.json(channels);
});

/* ------------------------------
   API: Modlog channel (get / set / disable)
------------------------------ */

app.get("/api/modlog/:guildId", requireGuildAccess, (req, res) => {
  res.json({ channel_id: getModlogChannel(req.params.guildId) });
});

app.post("/api/modlog/:guildId", requireGuildAccess, (req, res) => {
  const guild = client.guilds.cache.get(req.params.guildId);
  const { channel_id } = req.body;

  try {
    // Empty value = disable logging
    if (!channel_id) {
      modlogDb.prepare(`DELETE FROM modlog_settings WHERE guild_id = ?`).run(guild.id);
      return res.json({ success: true, channel_id: null });
    }

    const channel = guild.channels.cache.get(String(channel_id));

    if (!channel || channel.type !== ChannelType.GuildText) {
      return res.status(400).json({ error: "That isn't a text channel in this server." });
    }

    const canSend = channel
      .permissionsFor(guild.members.me)
      ?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);

    if (!canSend) {
      return res.status(400).json({ error: "Jarvis can't send messages in that channel." });
    }

    modlogDb
      .prepare(`
        INSERT INTO modlog_settings (guild_id, channel_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
      `)
      .run(guild.id, channel.id);

    res.json({ success: true, channel_id: channel.id });
  } catch (error) {
    console.error("MODLOG API ERROR:", error);
    res.status(500).json({ error: "Failed to save the log channel." });
  }
});

/* ------------------------------
   API: Live bot status
------------------------------ */

app.get("/api/status", (req, res) => {
  if (!getSession(req)) {
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