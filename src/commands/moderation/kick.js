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
  "../../database/kick.db"
);

const db = new Database(dbPath);

// Create the tables /kick needs if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS case_ids (
    guild_id TEXT PRIMARY KEY,
    last_case_id INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS modlog_settings (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT
  );
`);

// =====================================================
// COMMAND
// =====================================================

const command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server.")

    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to kick.")
        .setRequired(true)
    )

    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the kick.")
        .setRequired(false)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const moderator = interaction.user;

    const target =
      interaction.options.getUser("user");

    const reason =
      interaction.options.getString("reason") ||
      "No reason provided.";

    // ===================================================
    // FIND MEMBER
    // ===================================================

    const member = await guild.members
      .fetch(target.id)
      .catch(() => null);

    if (!member) {
      return interaction.reply({
        content: "❌ I can't find that user.",
        ephemeral: true,
      });
    }

    // ===================================================
    // PREVENT SELF KICK
    // ===================================================

    if (target.id === moderator.id) {
      return interaction.reply({
        content: "❌ You can't kick yourself.",
        ephemeral: true,
      });
    }

    // ===================================================
    // CHECK IF JARVIS CAN KICK USER
    // ===================================================

    if (!member.kickable) {
      return interaction.reply({
        content:
          "❌ I cannot kick this user. Their role may be higher than Jarvis's role, or Jarvis may not have permission to kick them.",
        ephemeral: true,
      });
    }

    // ===================================================
    // DM USER
    // ===================================================

    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(
          `👢 You were kicked from ${guild.name}`
        )
        .addFields(
          {
            name: "Reason",
            value: reason,
          },
          {
            name: "Moderator",
            value: moderator.tag,
          }
        )
        .setColor("#ff944d")
        .setTimestamp();

      await target.send({
        embeds: [dmEmbed],
      });
    } catch {
      // User may have DMs disabled.
      // Continue with the kick.
    }

    // ===================================================
    // KICK USER
    // ===================================================

    try {
      await member.kick(
        `${reason} | Moderator: ${moderator.tag}`
      );
    } catch (error) {
      console.error(
        "KICK ERROR:",
        error
      );

      return interaction.reply({
        content:
          "❌ Jarvis couldn't kick that user. Check Jarvis's permissions and role position.",
        ephemeral: true,
      });
    }

    // ===================================================
    // CASE ID
    // ===================================================

    let caseData = db
      .prepare(`
        SELECT last_case_id
        FROM case_ids
        WHERE guild_id = ?
      `)
      .get(guild.id);

    if (!caseData) {
      db.prepare(`
        INSERT INTO case_ids (
          guild_id,
          last_case_id
        )
        VALUES (?, ?)
      `).run(
        guild.id,
        0
      );

      caseData = {
        last_case_id: 0,
      };
    }

    const newCaseId =
      caseData.last_case_id + 1;

    db.prepare(`
      UPDATE case_ids
      SET last_case_id = ?
      WHERE guild_id = ?
    `).run(
      newCaseId,
      guild.id
    );

    // ===================================================
    // MODLOG
    // ===================================================

    const modlog = db
      .prepare(`
        SELECT channel_id
        FROM modlog_settings
        WHERE guild_id = ?
      `)
      .get(guild.id);

    if (
      modlog &&
      modlog.channel_id
    ) {
      const logChannel =
        guild.channels.cache.get(
          modlog.channel_id
        );

      if (
        logChannel &&
        logChannel.isTextBased()
      ) {
        try {
          const logEmbed =
            new EmbedBuilder()
              .setTitle("👢 Kick Action")
              .setColor("#ff944d")
              .addFields(
                {
                  name: "User",
                  value:
                    `${target.tag} (${target.id})`,
                },
                {
                  name: "Moderator",
                  value:
                    `${moderator.tag} (${moderator.id})`,
                },
                {
                  name: "Reason",
                  value: reason,
                },
                {
                  name: "Guild",
                  value: guild.name,
                }
              )
              .setFooter({
                text:
                  `Case #${newCaseId}`,
              })
              .setTimestamp();

          await logChannel.send({
            embeds: [logEmbed],
          });
        } catch (error) {
          console.error(
            "KICK MODLOG ERROR:",
            error
          );
        }
      }
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    const successEmbed =
      new EmbedBuilder()
        .setTitle("👢 Member Kicked")
        .setColor("#ff944d")
        .setDescription(
          `**${target.tag}** has been kicked.`
        )
        .addFields(
          {
            name: "Reason",
            value: reason,
          },
          {
            name: "Case",
            value: `#${newCaseId}`,
          }
        )
        .setTimestamp();

    return interaction.reply({
      embeds: [successEmbed],
      ephemeral: true,
    });
  },
};

export default command;