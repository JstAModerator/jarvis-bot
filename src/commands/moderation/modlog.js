import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";

import { db, getModlogChannel } from "../../database/moderation.js";

// =====================================================
// COMMAND
// =====================================================

const command = {
  data: new SlashCommandBuilder()
    .setName("modlog")
    .setDescription("Manage the moderation log channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set the channel where mod actions are logged.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to send mod logs to.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Show the current modlog channel.")
    )

    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Stop logging mod actions to a channel.")
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    // ===================================================
    // SET
    // ===================================================

    if (sub === "set") {
      const channel = interaction.options.getChannel("channel");

      // Make sure Jarvis can actually send messages there
      const permissions = channel.permissionsFor(guild.members.me);

      if (
        !permissions?.has(PermissionFlagsBits.ViewChannel) ||
        !permissions?.has(PermissionFlagsBits.SendMessages)
      ) {
        return interaction.reply({
          content: `❌ I don't have permission to send messages in ${channel}. Give me **View Channel** and **Send Messages** there first.`,
          ephemeral: true,
        });
      }

      try {
        db.prepare(`
          INSERT INTO modlog_settings (guild_id, channel_id)
          VALUES (?, ?)
          ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
        `).run(guild.id, channel.id);
      } catch (error) {
        console.error("MODLOG SET ERROR:", error);

        return interaction.reply({
          content: "❌ Jarvis couldn't save that modlog channel.",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📋 Modlog Channel Set")
        .setColor("#6a4cff")
        .setDescription(`Moderation actions will now be logged in ${channel}.`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ===================================================
    // VIEW
    // ===================================================

    if (sub === "view") {
      const channelId = getModlogChannel(guild.id);

      if (!channelId) {
        return interaction.reply({
          content: "ℹ️ No modlog channel is currently set.",
          ephemeral: true,
        });
      }

      const channel = guild.channels.cache.get(channelId);

      return interaction.reply({
        content: channel
          ? `📋 Modlog is currently set to ${channel}.`
          : `⚠️ Modlog is set to a channel I can no longer find (ID: \`${channelId}\`). It may have been deleted — you should set a new one.`,
        ephemeral: true,
      });
    }

    // ===================================================
    // DISABLE
    // ===================================================

    if (sub === "disable") {
      try {
        db.prepare(`
          DELETE FROM modlog_settings
          WHERE guild_id = ?
        `).run(guild.id);
      } catch (error) {
        console.error("MODLOG DISABLE ERROR:", error);

        return interaction.reply({
          content: "❌ Jarvis couldn't disable the modlog.",
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: "🔕 Modlog disabled. Mod actions will no longer be logged.",
        ephemeral: true,
      });
    }
  },
};

export default command;