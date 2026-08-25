import fs from "fs";
import path from "path";
import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Resolve directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({
  path: path.join(__dirname, "../.env"),
  override: true,
});

// Auto-load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

const commands = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(filePath);

  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
    console.log(`✔ Loaded command: ${command.data.name}`);
  } else {
    console.log(`⚠ Skipped ${file} — missing data or execute`);
  }
}

// REST client
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// Detect environment
const isProduction = process.env.NODE_ENV === "production";

async function deploy() {
  try {
    console.log("Registering slash commands...");

    if (isProduction) {
      // 🧹 Clean guild commands to prevent duplicates
      const existingGuildCommands = await rest.get(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      );

      if (existingGuildCommands.length > 0) {
        console.log("🧹 Cleaning up old guild commands...");
        for (const cmd of existingGuildCommands) {
          await rest.delete(
            Routes.applicationGuildCommand(
              process.env.CLIENT_ID,
              process.env.GUILD_ID,
              cmd.id
            )
          );
        }
      }

      // 🌍 Deploy GLOBAL commands (Render)
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log("🌍 Global commands deployed (Render)");
    } else {
      // 🛠 Deploy GUILD commands (Local dev)
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.CLIENT_ID,
          process.env.GUILD_ID
        ),
        { body: commands }
      );
      console.log("🛠 Guild commands deployed (Local)");
    }

    console.log("✅ Deployment complete!");
  } catch (error) {
    console.error("❌ Deployment failed:", error);
  }
}

deploy();
