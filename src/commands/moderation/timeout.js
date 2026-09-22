import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";

import { getNextCaseId, getModlogChannel } from "../../database/moderation.js";

const MAX_TIMEOUT_MINUTES = 40320; // Discord's 28-day cap

const command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user for a specific duration.")
    .addUserOption((option) =>
      option.setName("user").setDescription("The user to timeout.").setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName("minutes").setDescription("Duration in minutes.").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the timeout.").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const guild = interaction.guild;
    const moderator = interaction.user;

    const target = interaction.options.getUser("user");
    const minutes = interaction.options.getInteger("minutes");
    const reason = interaction.options.getString("reason") || "No reason provided.";

    if (minutes < 1) {
      return interaction.reply({
        content: "❌ Duration must be at least **1 minute**.",
        ephemeral: true,
      });
    }

    if (minutes > MAX_TIMEOUT_MINUTES) {
      return interaction.reply({
        content: `❌ Duration can't exceed **${MAX_TIMEOUT_MINUTES} minutes** (28 days), which is Discord's max timeout length.`,
        ephemeral: true,
      });
    }

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "❌ I can't find that user.", ephemeral: true });
    }

    if (target.id === moderator.id) {
      return interaction.reply({ content: "❌ You can't time yourself out.", ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({
        content: "❌ I cannot timeout this user. Their role may be higher than Jarvis's role, or Jarvis may not have permission.",
        ephemeral: true,
      });
    }

    const ms = minutes * 60 * 1000;

    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`⏳ You were timed out in ${guild.name}`)
        .addFields(
          { name: "Duration", value: `${minutes} minutes` },
          { name: "Reason", value: reason },
          { name: "Moderator", value: moderator.tag }
        )
        .setColor("#4da6ff")
        .setTimestamp();

      await target.send({ embeds: [dmEmbed] });
    } catch {}

    try {
      await member.timeout(ms, `${reason} | Moderator: ${moderator.tag}`);
    } catch (error) {
      console.error("TIMEOUT ERROR:", error);
      return interaction.reply({
        content: "❌ Jarvis couldn't timeout that user. Check Jarvis's permissions and role position.",
        ephemeral: true,
      });
    }

    const newCaseId = getNextCaseId(guild.id);

    const modlogChannelId = getModlogChannel(guild.id);
    if (modlogChannelId) {
      const logChannel = guild.channels.cache.get(modlogChannelId);

      if (logChannel && logChannel.isTextBased()) {
        try {
          const logEmbed = new EmbedBuilder()
            .setTitle("⏳ Timeout Action")
            .setColor("#4da6ff")
            .addFields(
              { name: "User", value: `${target.tag} (${target.id})` },
              { name: "Moderator", value: `${moderator.tag} (${moderator.id})` },
              { name: "Duration", value: `${minutes} minutes` },
              { name: "Reason", value: reason },
              { name: "Guild", value: guild.name }
            )
            .setFooter({ text: `Case #${newCaseId}` })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        } catch (error) {
          console.error("TIMEOUT MODLOG ERROR:", error);
        }
      }
    }

    return interaction.reply({
      content: `⏳ **${target.tag}** has been timed out for ${minutes} minutes.`,
      ephemeral: true,
    });
  },
};

export default command;