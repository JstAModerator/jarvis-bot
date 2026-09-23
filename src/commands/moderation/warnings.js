import {
  SlashCommandBuilder,
  EmbedBuilder,
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
    .setName("warnings")
    .setDescription("View a user's warnings")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    )

    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to check")
        .setRequired(true)
    ),

  async execute(interaction) {
    const user =
      interaction.options.getUser("user");

    // ===================================================
    // FETCH WARNINGS
    // ===================================================

    let rows;

    try {
      rows = db
        .prepare(`
          SELECT *
          FROM warnings
          WHERE guild_id = ? AND user_id = ?
          ORDER BY timestamp DESC
        `)
        .all(interaction.guild.id, user.id);
    } catch (error) {
      console.error(
        "WARNINGS LOOKUP ERROR:",
        error
      );

      return interaction.reply({
        content:
          "❌ Jarvis couldn't look up that user's warnings.",
        ephemeral: true,
      });
    }

    if (rows.length === 0) {
      return interaction.reply({
        content: `✅ **${user.tag}** has no warnings.`,
        ephemeral: true,
      });
    }

    // ===================================================
    // BUILD LIST (capped so it doesn't blow past Discord's 4096-char embed description limit)
    // ===================================================

    const MAX_SHOWN = 15;
    const shown = rows.slice(0, MAX_SHOWN);

    let list = shown
      .map((w) => {
        const caseLabel =
          w.case_id != null
            ? `Case #${w.case_id}`
            : "Case #—"; // older warnings saved before case tracking was added

        return (
          `**${caseLabel}** — ${new Date(w.timestamp).toLocaleString()}\n` +
          `${w.reason} *(by <@${w.moderator_id}>)*`
        );
      })
      .join("\n\n");

    if (rows.length > MAX_SHOWN) {
      list += `\n\n*...and ${rows.length - MAX_SHOWN} more not shown.*`;
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Warnings for ${user.tag}`)
      .setDescription(list)
      .setColor("#ffcc4d")
      .setFooter({ text: `Total: ${rows.length}` });

    return interaction.reply({
      embeds: [embed],
      ephemeral: false,
    });
  },
};

export default command;