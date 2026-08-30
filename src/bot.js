import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Resolve directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ============================================================
   KEEP-ALIVE SERVER + SELF-PING (PREVENTS RENDER SLEEPING)
   ============================================================ */

const app = express();
const PORT = process.env.PORT || 10000;

// Basic web server for Render
app.get("/", (req, res) => res.send("Jarvis is alive!"));

// Start server
app.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

// Self-ping every 4 minutes
setInterval(() => {
  fetch("https://jarvis-bot-fod2.onrender.com")
    .then(() => console.log("Keep-alive ping sent"))
    .catch(() => console.log("Keep-alive ping failed"));
}, 240000); // 4 minutes


/* ============================================================
   DISCORD BOT CLIENT
   ============================================================ */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
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
import path from "path";

// Serve homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "index.html"));
});

// Serve CSS
app.get("/styles.css", (req, res) => {
  res.sendFile(path.join(__dirname, "website", "styles.css"));
});