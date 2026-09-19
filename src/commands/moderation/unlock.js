import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("unlock")
  .setDescription("Unlock the current channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const channel = interaction.channel;

  try {
    await channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      { SendMessages: true }
    );

    await interaction.reply({
      content: `🔓 Channel unlocked. Everyone can speak again.`,
      ephemeral: false
    });
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: "❌ I couldn't unlock this channel. Check my permissions.",
      ephemeral: true
    });
  }
}
