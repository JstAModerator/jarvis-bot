import { SlashCommandBuilder } from "discord.js";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

// Resolve directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to database
const db = new Database(path.join(__dirname, "..", "database", "settings.db"));

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

export const data = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("View or update Jarvis server settings")
  .addStringOption(option =>
    option.setName("embed_color")
      .setDescription("Set the embed color (hex code, e.g. #6a4cff)")
  )
  .addStringOption(option =>
    option.setName("welcome_message")
      .setDescription("Set the welcome message")
  )
  .addStringOption(option =>
    option.setName("meme_source")
      .setDescription("Set meme source (default or reddit)")
  );

export async function execute(interaction) {

  // ⭐ ADMIN‑ONLY PROTECTION ⭐
  if (!interaction.member.permissions.has("Administrator")) {
    return interaction.reply({
      content: "Only server admins can change Jarvis settings.",
      ephemeral: true
    });
  }

  const guildId = interaction.guild.id;

  // Ensure settings exist
  createDefaultSettings(guildId);

  const embedColor = interaction.options.getString("embed_color");
  const welcomeMessage = interaction.options.getString("welcome_message");
  const memeSource = interaction.options.getString("meme_source");

  if (embedColor) updateSetting(guildId, "embed_color", embedColor);
  if (welcomeMessage) updateSetting(guildId, "welcome_message", welcomeMessage);
  if (memeSource) updateSetting(guildId, "meme_source", memeSource);

  const settings = getSettings(guildId);

  await interaction.reply({
    embeds: [
      {
        title: "Jarvis Settings",
        color: parseInt(settings.embed_color.replace("#", ""), 16),
        fields: [
          { name: "Embed Color", value: settings.embed_color },
          { name: "Welcome Message", value: settings.welcome_message },
          { name: "Meme Source", value: settings.meme_source }
        ]
      }
    ]
  });
}
