import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Resolve directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create client
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
client.once("ready", onReady);
client.once("clientReady", onReady);

// Interaction handler
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

// Login (token must be set in Render Environment)
if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing. Set it in Render environment.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("❌ Failed to login to Discord:", err);
  process.exit(1);
});

// Express keep‑alive for Render Web Service
const app = express();

app.get("/", (req, res) => {
  res.send("Jarvis is alive!");
});

// IMPORTANT: let Render control the port
const PORT = process.env.PORT;
if (!PORT) {
  console.error("❌ PORT is missing. Render should provide this for Web Services.");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Express keep-alive server running on port ${PORT}`);
});
