import { SlashCommandBuilder } from "discord.js";

// =====================================================
// COMMAND
// =====================================================

const command = {
  data: new SlashCommandBuilder()
    .setName("calc")
    .setDescription("Calculate a math expression.")

    .addStringOption((option) =>
      option
        .setName("expression")
        .setDescription("Math expression (e.g., 5+5*2)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const expr = interaction.options.getString("expression");

    try {
      const result = Function(`"use strict"; return (${expr})`)();

      await interaction.reply(`🧮 **${expr} = ${result}**`);
    } catch {
      await interaction.reply("❌ Invalid expression.");
    }
  },
};

export default command;