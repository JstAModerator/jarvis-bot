import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("slowmode")
  .setDescription("Set slowmode for the current channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addIntegerOption(opt =>
    opt
      .setName("seconds")
      .setDescription("Slowmode duration in seconds (0–21600)")
      .setRequired(true)
  );

export async function execute(interaction) {
  const seconds = interaction.options.getInteger("seconds");

  if (seconds < 0 || seconds > 21600) {
    return interaction.reply({
      content: "❌ Slowmode must be between **0 and 21600 seconds** (6 hours).",
      ephemeral: true
    });
  }

  try {
    await interaction.channel.setRateLimitPerUser(seconds);

    await interaction.reply({
      content:
        seconds === 0
          ? "🐌 Slowmode **disabled** for this channel."
          : `🐌 Slowmode set to **${seconds} seconds**.`,
      ephemeral: false
    });
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: "❌ I couldn't change slowmode. Check my permissions.",
      ephemeral: true
    });
  }
}
