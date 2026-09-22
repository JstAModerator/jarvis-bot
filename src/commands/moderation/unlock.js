import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";

// =====================================================
// COMMAND
// =====================================================

const command = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock the current channel")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels
    ),

  async execute(interaction) {
    const channel = interaction.channel;

    // ===================================================
    // UNLOCK CHANNEL
    // ===================================================

    try {
      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { SendMessages: true }
      );
    } catch (error) {
      console.error(
        "UNLOCK ERROR:",
        error
      );

      return interaction.reply({
        content:
          "❌ I couldn't unlock this channel. Check my permissions.",
        ephemeral: true,
      });
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    await interaction.reply({
      content: `🔓 Channel unlocked. Everyone can speak again.`,
      ephemeral: false,
    });
  },
};

export default command;