import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";

// =====================================================
// COMMAND
// =====================================================

const command = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set slowmode for the current channel")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels
    )

    .addIntegerOption((option) =>
      option
        .setName("seconds")
        .setDescription("Slowmode duration in seconds (0–21600)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const seconds =
      interaction.options.getInteger("seconds");

    // ===================================================
    // VALIDATE SECONDS
    // ===================================================

    if (seconds < 0 || seconds > 21600) {
      return interaction.reply({
        content:
          "❌ Slowmode must be between **0 and 21600 seconds** (6 hours).",
        ephemeral: true,
      });
    }

    // ===================================================
    // SET SLOWMODE
    // ===================================================

    try {
      await interaction.channel.setRateLimitPerUser(seconds);
    } catch (error) {
      console.error(
        "SLOWMODE ERROR:",
        error
      );

      return interaction.reply({
        content:
          "❌ I couldn't change slowmode. Check my permissions.",
        ephemeral: true,
      });
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    return interaction.reply({
      content:
        seconds === 0
          ? "🐌 Slowmode **disabled** for this channel."
          : `🐌 Slowmode set to **${seconds} seconds**.`,
      ephemeral: false,
    });
  },
};

export default command;