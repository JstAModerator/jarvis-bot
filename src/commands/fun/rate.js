import { SlashCommandBuilder } from "discord.js";

const command = {
  data: new SlashCommandBuilder()
    .setName("rate")
    .setDescription("Jarvis rates anything from 0% to 100%.")
    .addStringOption((option) =>
      option
        .setName("thing")
        .setDescription("What do you want Jarvis to rate?")
        .setRequired(true)
    ),

  async execute(interaction) {
    const thing = interaction.options.getString("thing");

    const rating = Math.floor(Math.random() * 101);

    await interaction.reply(
      `⭐ **${thing}** rate = **${rating}%**`
    );
  },
};

export default command;