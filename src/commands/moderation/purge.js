import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";

// =====================================================
// COMMAND
// =====================================================

const command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete a number of messages from the channel")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    )

    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of messages to delete (1–100)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const amount =
      interaction.options.getInteger("amount");

    // ===================================================
    // VALIDATE AMOUNT
    // ===================================================

    if (amount < 1 || amount > 100) {
      return interaction.reply({
        content: "❌ You must choose a number between **1 and 100**.",
        ephemeral: true,
      });
    }

    // ===================================================
    // PURGE MESSAGES
    // ===================================================

    let deleted;

    try {
      deleted = await interaction.channel.bulkDelete(amount, true);
    } catch (error) {
      console.error(
        "PURGE ERROR:",
        error
      );

      return interaction.reply({
        content:
          "❌ I couldn't delete messages here. I may not have permission.",
        ephemeral: true,
      });
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    const deletedCount = deleted.size;
    const skippedCount = amount - deletedCount;

    let content = `🧹 Deleted **${deletedCount}** message(s).`;

    if (skippedCount > 0) {
      content +=
        `\n⚠️ Skipped **${skippedCount}** message(s) older than 14 days ` +
        `(Discord doesn't allow bulk-deleting those).`;
    }

    return interaction.reply({
      content,
      ephemeral: true,
    });
  },
};

export default command;