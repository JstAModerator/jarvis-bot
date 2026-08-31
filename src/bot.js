import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import express from "express";
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

// Create settings table
db.prepare(`
  CREATE TABLE IF NOT EXISTS server_settings (
    guild_id TEXT PRIMARY KEY,
    embed_color TEXT DEFAULT '#6a4cff',
    welcome_message TEXT DEFAULT 'Welcome to the server!',
    meme_source TEXT DEFAULT 'default'
  )
`).run();

// Helper: get settings
function getSettings(guildId) {
  return db.prepare(`SELECT * FROM server_settings WHERE guild_id = ?`).get(guildId);
}

// Helper: create default settings
function createDefaultSettings(guildId) {
  db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(guildId);
}

// Helper: update setting
function updateSetting(guildId, key, value) {
  db.prepare(`UPDATE server_settings SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
}


/* ============================================================
   KEEP-ALIVE SERVER + SELF-PING (PREVENTS RENDER SLEEPING)
   ============================================================ */

const app = express();
const PORT = process.env.PORT || 10000;

// Serve homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "index.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "dashboard.html"));
});

// Serve Terms of Service page
app.get("/tos", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "tos.html"));
});

// Serve Privacy Policy page
app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "privacy.html"));
});

// Serve CSS
app.get("/styles.css", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "styles.css"));
});

/* ============================================================
   API ROUTES (Dashboard → Bot Settings)
   ============================================================ */

app.use(express.json());

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

// Start server
app.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

// Self-ping every 4 minutes
setInterval(() => {
  fetch("https://jarvis-bot-fod2.onrender.com")
    .then(() => console.log("Keep-alive ping sent"))
    .catch(() => console.log("Keep-alive ping failed"));
}, 240000);


/* ============================================================
   DISCORD BOT CLIENT
   ============================================================ */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Auto-create settings when Jarvis joins a server
client.on("guildCreate", guild => {
  createDefaultSettings(guild.id);
  console.log(`Created settings for ${guild.name}`);
});

// Shared ready handler (works for v14 + v15)
async function onReady() {
  console.log(`Logged in as ${client.user.tag}`);

  // Command map
  client.commands = new Map();

  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs.readdirSync(commandsPath).filter(file =>
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

// Support both v14 (`ready`) and v15 (`clientReady`)
client.once("clientReady", onReady);


/* ============================================================
   INTERACTION HANDLER
   ============================================================ */

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const executor = client.commands.get(interaction.commandName);
  if (!executor) {
    return interaction.reply({
      content: "Command not found.",
      ephemeral: true
    });
  }

  try {
    await executor(interaction);
  } catch (error) {
    console.error(error);
    try {
      await interaction.reply({
        content: "Error executing command.",
        ephemeral: true
      });
    } catch {
      // ignore double reply errors
    }
  }
});


/* ============================================================
   LOGIN
   ============================================================ */

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing. Set it in Render environment.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("❌ Failed to login to Discord:", err);
  process.exit(1);
});
