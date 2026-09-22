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

// =====================================================
// COMMAND
// =====================================================

const command = {
  data: new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("Clear all warnings for a user")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    )

    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to clear warnings for")
        .setRequired(true)
    ),

  async execute(interaction) {
    const user =
      interaction.options.getUser("user");

    // ===================================================
    // PREVENT SELF CLEAR
    // ===================================================

    if (user.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ You can't clear your own warnings.",
        ephemeral: true,
      });
    }

    // ===================================================
    // CHECK IF THERE ARE ANY WARNINGS
    // ===================================================

    let existing;

    try {
      existing = db
        .prepare(`
          SELECT COUNT(*) AS count
          FROM warnings
          WHERE guild_id = ? AND user_id = ?
        `)
        .get(interaction.guild.id, user.id);
    } catch (error) {
      console.error(
        "CLEARWARNINGS LOOKUP ERROR:",
        error
      );

      return interaction.reply({
        content:
          "❌ Jarvis couldn't check that user's warnings.",
        ephemeral: true,
      });
    }

    if (!existing || existing.count === 0) {
      return interaction.reply({
        content: `ℹ️ **${user.tag}** has no warnings to clear.`,
        ephemeral: true,
      });
    }

    // ===================================================
    // CLEAR WARNINGS
    // ===================================================

    try {
      db.prepare(`
        DELETE FROM warnings
        WHERE guild_id = ? AND user_id = ?
      `).run(interaction.guild.id, user.id);
    } catch (error) {
      console.error(
        "CLEARWARNINGS DELETE ERROR:",
        error
      );

      return interaction.reply({
        content:
          "❌ Jarvis couldn't clear that user's warnings.",
        ephemeral: true,
      });
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    await interaction.reply({
      content:
        `🧹 Cleared **${existing.count}** warning(s) for **${user.tag}**.`,
      ephemeral: false,
    });
  },
};

export default command;