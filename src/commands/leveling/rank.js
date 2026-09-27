import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
  getUser,
  calculateLevel,
  xpIntoLevel,
  xpToNextLevel,
  getRank,
} from "../../database/xp.js";

function buildProgressBar(current, total, length = 20) {
  const filled = Math.round((current / total) * length);
  const empty = length - filled;

  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, empty));
}

const command = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Check your (or someone else's) level and XP.")

    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to check")
        .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser("user") || interaction.user;
    const guildId = interaction.guild.id;

    const user = getUser(guildId, target.id);
    const level = calculateLevel(user.xp);
    const intoLevel = xpIntoLevel(user.xp);
    const needed = xpToNextLevel(level);
    const rank = getRank(guildId, target.id);

    const bar = buildProgressBar(intoLevel, needed);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Rank — ${target.tag}`)
      .setColor("#6a4cff")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "Level", value: `${level}`, inline: true },
        { name: "Rank", value: rank ? `#${rank}` : "Unranked", inline: true },
        { name: "Total XP", value: `${user.xp}`, inline: true },
        { name: "Progress", value: `${bar}\n${intoLevel} / ${needed} XP` }
      );

    return interaction.reply({ embeds: [embed] });
  },
};

export default command;