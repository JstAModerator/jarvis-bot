import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

import { getNextCaseId, getModlogChannel } from "../../database/moderation.js";

// =====================================================
// DATABASE (warning records stay in their own db)
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(
  __dirname,
  "../../database/warnings.db"
);

const db = new Database(dbPath);

db.prepare(`
  CREATE TABLE IF NOT EXISTS warnings (
    guild_id TEXT,
    user_id TEXT,
    moderator_id TEXT,
    reason TEXT,
    timestamp INTEGER,
    case_id INTEGER
  )
`).run();

// =====================================================
// COMMAND
// =====================================================

const command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    )

    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to warn")
        .setRequired(true)
    )

    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the warning")
        .setRequired(true)
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const moderator = interaction.user;

    const user =
      interaction.options.getUser("user");

    const reason =
      interaction.options.getString("reason");

    // ===================================================
    // PREVENT SELF WARNING
    // ===================================================

    if (user.id === moderator.id) {
      return interaction.reply({
        content: "❌ You can't warn yourself.",
        ephemeral: true,
      });
    }

    // ===================================================
    // CASE ID (shared per-guild counter across all mod commands)
    // ===================================================

    const newCaseId = getNextCaseId(guild.id);

    // ===================================================
    // SAVE WARNING
    // ===================================================

    try {
      db.prepare(`
        INSERT INTO warnings (
          guild_id,
          user_id,
          moderator_id,
          reason,
          timestamp,
          case_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        guild.id,
        user.id,
        moderator.id,
        reason,
        Date.now(),
        newCaseId
      );
    } catch (error) {
      console.error(
        "WARN DATABASE ERROR:",
        error
      );

      return interaction.reply({
        content: "❌ Jarvis couldn't save that warning.",
        ephemeral: true,
      });
    }

    // ===================================================
    // MODLOG
    // ===================================================

    const modlogChannelId = getModlogChannel(guild.id);

    if (modlogChannelId) {
      const logChannel = guild.channels.cache.get(
        modlogChannelId
      );

      if (logChannel && logChannel.isTextBased()) {
        try {
          const logEmbed = new EmbedBuilder()
            .setTitle("⚠️ Warn Action")
            .setColor("#ffcc4d")
            .addFields(
              { name: "User", value: `${user.tag} (${user.id})` },
              { name: "Moderator", value: `${moderator.tag} (${moderator.id})` },
              { name: "Reason", value: reason },
              { name: "Guild", value: guild.name }
            )
            .setFooter({ text: `Case #${newCaseId}` })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        } catch (error) {
          console.error(
            "WARN MODLOG ERROR:",
            error
          );
        }
      }
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    await interaction.reply({
      content:
        `⚠️ **${user.tag}** has been warned.\n` +
        `Reason: **${reason}** *(Case #${newCaseId})*`,
      ephemeral: false,
    });
  },
};

export default command;