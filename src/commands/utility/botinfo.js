import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("botinfo")
  .setDescription("Shows information about Jarvis.");

export async function execute(interaction) {
  const client = interaction.client;

  await interaction.reply({
    embeds: [
      {
        title: "Jarvis — Bot Info",
        fields: [
          { name: "Servers", value: `${client.guilds.cache.size}`, inline: true },
          { name: "Users", value: `${client.users.cache.size}`, inline: true },
          { name: "Uptime", value: `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>`, inline: true }
        ],
        color: 0x5865F2
      }
    ]
  });
}
