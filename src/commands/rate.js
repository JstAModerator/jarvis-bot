import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("rate")
  .setDescription("Jarvis rates anything from 1 to 10.")
  .addStringOption(option =>
    option.setName("thing")
      .setDescription("What do you want Jarvis to rate?")
      .setRequired(true)
  );

export async function execute(interaction) {
  const thing = interaction.options.getString("thing");
  const rating = Math.floor(Math.random() * 10) + 1;

  await interaction.reply(`⭐ I rate **${thing}** a **${rating}/10**`);
}
