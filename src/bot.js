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

// Load commands AFTER bot is ready
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.commands = new Map();

  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

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
});

// Interaction handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const executor = client.commands.get(interaction.commandName);
  if (!executor) {
    return interaction.reply({ content: "Command not found.", ephemeral: true });
  }

  try {
    await executor(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "Error executing command.",
      ephemeral: true
    });
  }
});

// Login
client.login(process.env.DISCORD_TOKEN);

// Express keep‑alive
const app = express();
app.get("/", (req, res) => res.send("Jarvis is alive!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Express keep-alive server running on port ${PORT}`));
