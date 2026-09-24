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

// =====================================================
// RECURSIVELY COLLECT ALL .js FILES UNDER commands/
// =====================================================

function getCommandFiles(dir) {
  let results = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(getCommandFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      results.push(fullPath);
    }
  }

  return results;
}

const commandsPath = path.join(__dirname, "commands");
const commandFilePaths = getCommandFiles(commandsPath);

const commands = [];

for (const filePath of commandFilePaths) {
  const imported = await import(filePath);

  const command = imported.default ?? imported;

  if (command?.data && command?.execute) {
    commands.push(command.data.toJSON());
    console.log(`✔ Loaded command: ${command.data.name}`);
  } else {
    console.log(`⚠ Skipped ${path.relative(commandsPath, filePath)} — missing data or execute`);
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

      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log("🌍 Global commands deployed (Render)");
    } else {
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