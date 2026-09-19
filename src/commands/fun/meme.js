import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import fetch from "node-fetch";

export const data = new SlashCommandBuilder()
  .setName("meme")
  .setDescription("Sends a random meme from Reddit.");

async function getMeme() {
  const response = await fetch("https://meme-api.com/gimme");
  return await response.json();
}

export async function execute(interaction) {
  const meme = await getMeme();

  const memeEmbed = {
    title: meme.title,
    url: meme.postLink,
    image: { url: meme.url },
    footer: { text: `From r/${meme.subreddit}` },
    color: 0x5865F2
  };

  const nextButton = new ButtonBuilder()
    .setCustomId("next_meme")
    .setLabel("Next Meme 🔁")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(nextButton);

  await interaction.reply({ embeds: [memeEmbed], components: [row] });

  const collector = interaction.channel.createMessageComponentCollector({
    filter: i => i.customId === "next_meme" && i.user.id === interaction.user.id,
    time: 60000 // 1 minute
  });

  collector.on("collect", async i => {
    const newMeme = await getMeme();
    const newEmbed = {
      title: newMeme.title,
      url: newMeme.postLink,
      image: { url: newMeme.url },
      footer: { text: `From r/${newMeme.subreddit}` },
      color: 0x5865F2
    };
    await i.update({ embeds: [newEmbed], components: [row] });
  });

  collector.on("end", async () => {
    nextButton.setDisabled(true);
    const disabledRow = new ActionRowBuilder().addComponents(nextButton);
    await interaction.editReply({ components: [disabledRow] });
  });
}
