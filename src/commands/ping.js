import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Shows Jarvis's reaction time and API heartbeat.");

export async function execute(interaction) {
  const sent = await interaction.reply({ content: "Pinging...", fetchReply: true });
  const reactionTime = sent.createdTimestamp - interaction.createdTimestamp;
  const apiHeartbeat = interaction.client.ws.ping;

  await interaction.editReply(
    `🏓 Pong! Reaction time: **${reactionTime}ms** | ❤️ API heartbeat: **${apiHeartbeat}ms**`
  );
}
