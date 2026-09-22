import { SlashCommandBuilder } from "discord.js";

const responses = [
  "Absolutely, bro.",
  "Nah, not happening.",
  "Ask again later.",
  "Jarvis says yes.",
  "Jarvis says no.",
  "100% facts.",
  "I wouldn't bet on it.",
  "For sure, my guy.",
  "No doubt.",
  "Bro… what kinda question is that?"
];

const command = {
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("Ask Jarvis a question and get a random answer.")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("Your question")
        .setRequired(true)
    ),

  async execute(interaction) {
    const answer =
      responses[Math.floor(Math.random() * responses.length)];

    await interaction.reply(`🎱 **${answer}**`);
  },
};

export default command;