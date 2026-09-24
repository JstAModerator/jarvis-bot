import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from "discord.js";

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// =====================================================
// DATABASE
// settings.js lives at src/commands/settings/settings.js
// Shares the same settings.db that bot.js creates at
// src/database/settings.db (table: server_settings)
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(
  __dirname,
  "../../database/settings.db"
);

const db = new Database(dbPath);

db.prepare(`
  CREATE TABLE IF NOT EXISTS server_settings (
    guild_id TEXT PRIMARY KEY,
    embed_color TEXT DEFAULT '#6a4cff',
    welcome_message TEXT DEFAULT 'Welcome to the server!',
    meme_source TEXT DEFAULT 'default'
  )
`).run();

// Safely add xp_enabled / economy_enabled columns if this
// table was created before those columns existed.
const existingColumns = db
  .prepare(`PRAGMA table_info(server_settings)`)
  .all()
  .map((col) => col.name);

if (!existingColumns.includes("xp_enabled")) {
  db.prepare(`
    ALTER TABLE server_settings
    ADD COLUMN xp_enabled INTEGER DEFAULT 1
  `).run();
}

if (!existingColumns.includes("economy_enabled")) {
  db.prepare(`
    ALTER TABLE server_settings
    ADD COLUMN economy_enabled INTEGER DEFAULT 1
  `).run();
}

// =====================================================
// HELPERS
// =====================================================

function getSettings(guildId) {
  let row = db
    .prepare(`SELECT * FROM server_settings WHERE guild_id = ?`)
    .get(guildId);

  if (!row) {
    db.prepare(`
      INSERT OR IGNORE INTO server_settings (guild_id)
      VALUES (?)
    `).run(guildId);

    row = db
      .prepare(`SELECT * FROM server_settings WHERE guild_id = ?`)
      .get(guildId);
  }

  return row;
}

function buildEmbed(guild, settings) {
  return new EmbedBuilder()
    .setTitle(`⚙️ Jarvis Settings — ${guild.name}`)
    .setColor(settings.embed_color)
    .setDescription(
      "Manage your server's settings directly inside Discord.\n\nUse the buttons or dropdown below."
    )
    .addFields(
      { name: "🎨 Embed Color", value: settings.embed_color, inline: true },
      { name: "👋 Welcome Message", value: settings.welcome_message, inline: true },
      { name: "🎭 Meme Source", value: settings.meme_source, inline: true },
      { name: "⭐ XP System", value: settings.xp_enabled ? "Enabled" : "Disabled", inline: true },
      { name: "💰 Economy", value: settings.economy_enabled ? "Enabled" : "Disabled", inline: true }
    );
}

function buildButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_dashboard")
      .setLabel("Open Dashboard")
      .setStyle(ButtonStyle.Link)
      .setURL("https://jarvis-bot-fod2.onrender.com/dashboard"),

    new ButtonBuilder()
      .setCustomId("refresh_settings")
      .setLabel("Refresh")
      .setStyle(ButtonStyle.Primary)
  );
}

function buildDropdown() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("settings_menu")
      .setPlaceholder("Choose a setting to edit...")
      .addOptions(
        { label: "Change Embed Color", value: "embed_color" },
        { label: "Change Welcome Message", value: "welcome_message" },
        { label: "Change Meme Source", value: "meme_source" },
        { label: "Toggle XP System", value: "xp_toggle" },
        { label: "Toggle Economy", value: "economy_toggle" }
      )
  );
}

// =====================================================
// COMMAND
// =====================================================

const command = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("View and edit Jarvis settings for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const settings = getSettings(guildId);

    const embed = buildEmbed(interaction.guild, settings);
    const buttons = buildButtons();
    const dropdown = buildDropdown();

    await interaction.reply({
      embeds: [embed],
      components: [buttons, dropdown],
    });

    // ===================================================
    // COLLECTOR
    // ===================================================

    const collector = interaction.channel.createMessageComponentCollector({
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: "This menu isn't for you.",
          ephemeral: true,
        });
      }

      // Refresh button
      if (i.customId === "refresh_settings") {
        const fresh = getSettings(guildId);
        return i.update({
          embeds: [buildEmbed(interaction.guild, fresh)],
          components: [buttons, dropdown],
        });
      }

      // Dropdown actions
      if (i.customId === "settings_menu") {
        const choice = i.values[0];

        if (choice === "embed_color") {
          await i.reply({
            content: "Send the new embed color (hex code, e.g. `#8366ff`).",
            ephemeral: true,
          });

          const msgCollector = interaction.channel.createMessageCollector({
            filter: (m) => m.author.id === interaction.user.id,
            time: 30000,
            max: 1,
          });

          msgCollector.on("collect", (msg) => {
            db.prepare(`
              UPDATE server_settings
              SET embed_color = ?
              WHERE guild_id = ?
            `).run(msg.content, guildId);

            i.followUp({ content: "Embed color updated!", ephemeral: true });
          });

          return;
        }

        if (choice === "welcome_message") {
          await i.reply({
            content: "Send the new welcome message.",
            ephemeral: true,
          });

          const msgCollector = interaction.channel.createMessageCollector({
            filter: (m) => m.author.id === interaction.user.id,
            time: 30000,
            max: 1,
          });

          msgCollector.on("collect", (msg) => {
            db.prepare(`
              UPDATE server_settings
              SET welcome_message = ?
              WHERE guild_id = ?
            `).run(msg.content, guildId);

            i.followUp({ content: "Welcome message updated!", ephemeral: true });
          });

          return;
        }

        if (choice === "meme_source") {
          await i.reply({
            content: "Choose a meme source: `reddit`, `imgur`, or `tenor`.",
            ephemeral: true,
          });

          const msgCollector = interaction.channel.createMessageCollector({
            filter: (m) => m.author.id === interaction.user.id,
            time: 30000,
            max: 1,
          });

          msgCollector.on("collect", (msg) => {
            db.prepare(`
              UPDATE server_settings
              SET meme_source = ?
              WHERE guild_id = ?
            `).run(msg.content.toLowerCase(), guildId);

            i.followUp({ content: "Meme source updated!", ephemeral: true });
          });

          return;
        }

        if (choice === "xp_toggle") {
          const current = getSettings(guildId);

          db.prepare(`
            UPDATE server_settings
            SET xp_enabled = ?
            WHERE guild_id = ?
          `).run(current.xp_enabled ? 0 : 1, guildId);

          return i.reply({ content: "XP system toggled!", ephemeral: true });
        }

        if (choice === "economy_toggle") {
          const current = getSettings(guildId);

          db.prepare(`
            UPDATE server_settings
            SET economy_enabled = ?
            WHERE guild_id = ?
          `).run(current.economy_enabled ? 0 : 1, guildId);

          return i.reply({ content: "Economy toggled!", ephemeral: true });
        }
      }
    });
  },
};

export default command;