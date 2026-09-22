import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";

import { getNextCaseId, getModlogChannel } from "../../database/moderation.js";

const command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user by ID.")
    .addStringOption((option) =>
      option.setName("user_id").setDescription("The ID of the user to unban.").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the unban.").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const guild = interaction.guild;
    const moderator = interaction.user;

    const userId = interaction.options.getString("user_id");
    const reason = interaction.options.getString("reason") || "No reason provided.";

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({
        content: "❌ That doesn't look like a valid user ID.",
        ephemeral: true,
      });
    }

    try {
      await guild.members.unban(userId, `${reason} | Moderator: ${moderator.tag}`);
    } catch (error) {
      console.error("UNBAN ERROR:", error);
      return interaction.reply({
        content: "❌ That user is not banned or the ID is invalid.",
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
            .setTitle("🔓 Unban Action")
            .setColor("#4dff88")
            .addFields(
              { name: "User ID", value: userId },
              { name: "Moderator", value: `${moderator.tag} (${moderator.id})` },
              { name: "Reason", value: reason },
              { name: "Guild", value: guild.name }
            )
            .setFooter({ text: `Case #${newCaseId}` })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        } catch (error) {
          console.error("UNBAN MODLOG ERROR:", error);
        }
      }
    }

    return interaction.reply({
      content: `🔓 User **${userId}** has been unbanned.`,
      ephemeral: true,
    });
  },
};

export default command;