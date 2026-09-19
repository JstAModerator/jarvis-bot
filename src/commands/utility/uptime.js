import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("uptime")
  .setDescription("Shows how long Jarvis has been online.");

export async function execute(interaction) {
  const ms = interaction.client.uptime;

  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  await interaction.reply(
    `⏱️ Uptime: **${days}d ${hours}h ${minutes}m ${seconds}s**`
  );
}
