import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("purge")
  .setDescription("Delete a number of messages from the channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption(opt =>
    opt
      .setName("amount")
      .setDescription("Number of messages to delete (1–100)")
      .setRequired(true)
  );

export async function execute(interaction) {
  const amount = interaction.options.getInteger("amount");

  if (amount < 1 || amount > 100) {
    return interaction.reply({
      content: "❌ You must choose a number between **1 and 100**.",
      ephemeral: true
    });
  }

  try {
    await interaction.channel.bulkDelete(amount, true);

    await interaction.reply({
      content: `🧹 Deleted **${amount}** messages.`,
      ephemeral: true
    });
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: "❌ I couldn't delete messages here. I may not have permission.",
      ephemeral: true
    });
  }
}
