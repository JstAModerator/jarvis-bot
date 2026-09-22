import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";

// =====================================================
// COMMAND
// =====================================================

const command = {
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Lock the current channel so only staff can speak")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels
    ),

  async execute(interaction) {
    const channel = interaction.channel;

    // ===================================================
    // LOCK CHANNEL
    // ===================================================

    try {
      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { SendMessages: false }
      );
    } catch (error) {
      console.error(
        "LOCKDOWN ERROR:",
        error
      );

      return interaction.reply({
        content:
          "❌ I couldn't lock this channel. Check my permissions.",
        ephemeral: true,
      });
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    await interaction.reply({
      content: `🔒 Channel locked. Only staff can speak.`,
      ephemeral: false,
    });
  },
};

export default command;