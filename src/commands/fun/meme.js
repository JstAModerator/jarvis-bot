import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import fetch from "node-fetch";

async function getMeme() {
  const response = await fetch("https://meme-api.com/gimme");

  if (!response.ok) {
    throw new Error(`Meme API returned status ${response.status}`);
  }

  return await response.json();
}

const command = {
  data: new SlashCommandBuilder()
    .setName("meme")
    .setDescription("Sends a random meme from Reddit."),

  async execute(interaction) {
    try {
      const meme = await getMeme();

      const memeEmbed = {
        title: meme.title,
        url: meme.postLink,
        image: {
          url: meme.url,
        },
        footer: {
          text: `From r/${meme.subreddit}`,
        },
        color: 0x5865f2,
      };

      const nextButton = new ButtonBuilder()
        .setCustomId("next_meme")
        .setLabel("Next Meme 🔁")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(nextButton);

      const response = await interaction.reply({
        embeds: [memeEmbed],
        components: [row],
        fetchReply: true,
      });

      const collector = response.createMessageComponentCollector({
        filter: (i) =>
          i.customId === "next_meme" &&
          i.user.id === interaction.user.id,

        time: 60000,
      });

      collector.on("collect", async (i) => {
        try {
          const newMeme = await getMeme();

          const newEmbed = {
            title: newMeme.title,
            url: newMeme.postLink,
            image: {
              url: newMeme.url,
            },
            footer: {
              text: `From r/${newMeme.subreddit}`,
            },
            color: 0x5865f2,
          };

          await i.update({
            embeds: [newEmbed],
            components: [row],
          });
        } catch (error) {
          console.error("MEME BUTTON ERROR:", error);

          await i.reply({
            content: "❌ Jarvis couldn't grab another meme.",
            ephemeral: true,
          });
        }
      });

      collector.on("end", async () => {
        try {
          nextButton.setDisabled(true);

          const disabledRow =
            new ActionRowBuilder().addComponents(nextButton);

          await interaction.editReply({
            components: [disabledRow],
          });
        } catch (error) {
          console.error("MEME COLLECTOR END ERROR:", error);
        }
      });
    } catch (error) {
      console.error("MEME COMMAND ERROR:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Jarvis couldn't grab a meme right now.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Jarvis couldn't grab a meme right now.",
          ephemeral: true,
        });
      }
    }
  },
};

export default command;