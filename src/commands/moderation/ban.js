import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";

import { getNextCaseId, getModlogChannel } from "../../database/moderation.js";

// =====================================================
// COMMAND
// =====================================================

const command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server.")

    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to ban.")
        .setRequired(true)
    )

    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the ban.")
        .setRequired(false)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.BanMembers
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const moderator = interaction.user;

    const target =
      interaction.options.getUser("user");

    const reason =
      interaction.options.getString("reason") ||
      "No reason provided.";

    // ===================================================
    // FIND MEMBER
    // ===================================================

    const member = await guild.members
      .fetch(target.id)
      .catch(() => null);

    if (!member) {
      return interaction.reply({
        content:
          "❌ I can't find that user in the server.",
        ephemeral: true,
      });
    }

    // ===================================================
    // PREVENT SELF BAN
    // ===================================================

    if (target.id === moderator.id) {
      return interaction.reply({
        content: "❌ You can't ban yourself.",
        ephemeral: true,
      });
    }

    // ===================================================
    // CHECK IF JARVIS CAN BAN USER
    // ===================================================

    if (!member.bannable) {
      return interaction.reply({
        content:
          "❌ I cannot ban this user. Their role may be higher than Jarvis's role, or Jarvis may not have permission to ban them.",
        ephemeral: true,
      });
    }

    // ===================================================
    // UNIQUE BUTTON IDs
    // ===================================================

    const confirmId = `confirm_ban_${interaction.id}`;
    const cancelId = `cancel_ban_${interaction.id}`;

    // ===================================================
    // CONFIRMATION BUTTONS
    // ===================================================

    const confirmButton = new ButtonBuilder()
      .setCustomId(confirmId)
      .setLabel("Confirm Ban")
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId(cancelId)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(
      confirmButton,
      cancelButton
    );

    // ===================================================
    // CONFIRMATION EMBED
    // ===================================================

    const confirmEmbed = new EmbedBuilder()
      .setTitle("🔨 Ban Confirmation")
      .setDescription(
        `Are you sure you want to ban **${target.tag}**?\n\n` +
        `**Reason:** ${reason}`
      )
      .setColor("#ff4d4d")
      .setFooter({
        text: "This confirmation expires in 30 seconds.",
      });

    const response = await interaction.reply({
      embeds: [confirmEmbed],
      components: [row],
      ephemeral: true,
      fetchReply: true,
    });

    // ===================================================
    // WAIT FOR BUTTON
    // ===================================================

    let buttonInteraction;

    try {
      buttonInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,

        filter: (button) =>
          button.user.id === moderator.id &&
          (button.customId === confirmId ||
            button.customId === cancelId),

        time: 30000,
      });
    } catch {
      await interaction.editReply({
        content: "⌛ Ban confirmation expired. No one was banned.",
        embeds: [],
        components: [],
      });

      return;
    }

    // ===================================================
    // CANCEL
    // ===================================================

    if (buttonInteraction.customId === cancelId) {
      await buttonInteraction.update({
        content: "❌ Ban cancelled.",
        embeds: [],
        components: [],
      });

      return;
    }

    // ===================================================
    // CONFIRMED
    // ===================================================

    await buttonInteraction.update({
      content: `🔨 Banning **${target.tag}**...`,
      embeds: [],
      components: [],
    });

    // ===================================================
    // DM USER BEFORE BAN
    // ===================================================

    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`🔨 You were banned from ${guild.name}`)
        .addFields(
          { name: "Reason", value: reason },
          { name: "Moderator", value: moderator.tag }
        )
        .setColor("#ff4d4d")
        .setTimestamp();

      await target.send({ embeds: [dmEmbed] });
    } catch {
      // User may have DMs disabled.
      // Continue with the ban.
    }

    // ===================================================
    // BAN USER
    // ===================================================

    try {
      await member.ban({
        reason: `${reason} | Moderator: ${moderator.tag}`,
      });
    } catch (error) {
      console.error("BAN ERROR:", error);

      await interaction.editReply({
        content:
          "❌ Jarvis couldn't ban that user. Check Jarvis's permissions and role position.",
        embeds: [],
        components: [],
      });

      return;
    }

    // ===================================================
    // CASE ID (shared per-guild counter across all mod commands)
    // ===================================================

    const newCaseId = getNextCaseId(guild.id);

    // ===================================================
    // MODLOG
    // ===================================================

    const modlogChannelId = getModlogChannel(guild.id);

    if (modlogChannelId) {
      const logChannel = guild.channels.cache.get(modlogChannelId);

      if (logChannel && logChannel.isTextBased()) {
        try {
          const logEmbed = new EmbedBuilder()
            .setTitle("🔨 Ban Action")
            .setColor("#ff4d4d")
            .addFields(
              { name: "User", value: `${target.tag} (${target.id})` },
              { name: "Moderator", value: `${moderator.tag} (${moderator.id})` },
              { name: "Reason", value: reason },
              { name: "Guild", value: guild.name }
            )
            .setFooter({ text: `Case #${newCaseId}` })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        } catch (error) {
          console.error("BAN MODLOG ERROR:", error);
        }
      }
    }

    // ===================================================
    // FINAL RESPONSE
    // ===================================================

    const successEmbed = new EmbedBuilder()
      .setTitle("🔨 Member Banned")
      .setColor("#ff4d4d")
      .setDescription(`**${target.tag}** has been banned.`)
      .addFields(
        { name: "Reason", value: reason },
        { name: "Case", value: `#${newCaseId}` }
      )
      .setTimestamp();

    await interaction.editReply({
      content: "",
      embeds: [successEmbed],
      components: [],
    });
  },
};

export default command;