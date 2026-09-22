import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// =====================================================
// DATABASE
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(
  __dirname,
  "../../database/warnings.db"
);

const db = new Database(dbPath);

// Create warnings table if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS warnings (
    guild_id TEXT,
    user_id TEXT,
    moderator_id TEXT,
    reason TEXT,
    timestamp INTEGER
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
    const user =
      interaction.options.getUser("user");

    const reason =
      interaction.options.getString("reason");

    // ===================================================
    // PREVENT SELF WARNING
    // ===================================================

    if (user.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ You can't warn yourself.",
        ephemeral: true,
      });
    }

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
          timestamp
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        interaction.guild.id,
        user.id,
        interaction.user.id,
        reason,
        Date.now()
      );
    } catch (error) {
      console.error(
        "WARN DATABASE ERROR:",
        error
      );

      return interaction.reply({
        content:
          "❌ Jarvis couldn't save that warning.",
        ephemeral: true,
      });
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    await interaction.reply({
      content:
        `⚠️ **${user.tag}** has been warned.\n` +
        `Reason: **${reason}**`,
      ephemeral: false,
    });
  },
};

export default command;