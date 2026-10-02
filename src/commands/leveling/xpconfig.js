import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";

import {
  blacklistChannel,
  unblacklistChannel,
  getBlacklistedChannels,
} from "../../database/xp.js";

const command = {
  data: new SlashCommandBuilder()
    .setName("xpconfig")
    .setDescription("Control which channels can earn XP.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand((sub) =>
      sub
        .setName("block")
        .setDescription("Stop a channel from earning XP.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Text or voice channel to block")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildVoice
            )
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("unblock")
        .setDescription("Allow a previously blocked channel to earn XP again.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel to unblock")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildVoice
            )
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all XP-blocked channels.")
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    if (sub === "block") {
      const channel = interaction.options.getChannel("channel");

      blacklistChannel(guild.id, channel.id);

      return interaction.reply({
        content: `🚫 ${channel} will no longer earn XP.`,
        ephemeral: true,
      });
    }

    if (sub === "unblock") {
      const channel = interaction.options.getChannel("channel");

      unblacklistChannel(guild.id, channel.id);

      return interaction.reply({
        content: `✅ ${channel} can earn XP again.`,
        ephemeral: true,
      });
    }

    if (sub === "list") {
      const channelIds = getBlacklistedChannels(guild.id);

      if (channelIds.length === 0) {
        return interaction.reply({
          content: "No channels are currently blocked from earning XP.",
          ephemeral: true,
        });
      }

      const lines = channelIds.map((id) => {
        const channel = guild.channels.cache.get(id);
        return channel ? `${channel}` : `Unknown Channel (${id})`;
      });

      const embed = new EmbedBuilder()
        .setTitle("🚫 XP-Blocked Channels")
        .setColor("#6a4cff")
        .setDescription(lines.join("\n"));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default command;