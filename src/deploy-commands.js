import fs from "fs";
import path from "path";
import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Resolve correct directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env strictly
dotenv.config({
  path: path.join(__dirname, "../.env"),
  override: true,
});

// Debug env
console.log("Loaded ENV:", {
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  DISCORD_TOKEN: process.env.DISCORD_TOKEN?.slice(0, 10) + "...",
});

// Auto‑load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

const commands = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(filePath);

  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
    console.log(`✔ Loaded command: ${file}`);
  } else {
    console.log(`⚠ Skipped ${file} — missing data or execute`);
  }
}

// REST client
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// Deploy
async function deploy() {
  try {
    console.log("Registering slash commands...");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("✅ Commands deployed successfully!");
  } catch (error) {
    console.error("❌ Deployment failed:", error);
  }
}

deploy();
