import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("lockdown")
  .setDescription("Lock the current channel so only staff can speak")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
  const channel = interaction.channel;

  try {
    await channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      { SendMessages: false }
    );

    await interaction.reply({
      content: `🔒 Channel locked. Only staff can speak.`,
      ephemeral: false
    });
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: "❌ I couldn't lock this channel. Check my permissions.",
      ephemeral: true
    });
  }
}
