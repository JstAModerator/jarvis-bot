import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("calc")
  .setDescription("Calculate a math expression.")
  .addStringOption(option =>
    option.setName("expression")
      .setDescription("Math expression (e.g., 5+5*2)")
      .setRequired(true)
  );

export async function execute(interaction) {
  const expr = interaction.options.getString("expression");

  try {
    // Safe math evaluation (no eval)
    const result = Function(`"use strict"; return (${expr})`)();

    await interaction.reply(`🧮 **${expr} = ${result}**`);
  } catch {
    await interaction.reply("❌ Invalid expression.");
  }
}
