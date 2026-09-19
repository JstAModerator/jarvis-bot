const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

const db = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user by ID.")
    .addStringOption(option =>
      option.setName("user_id")
        .setDescription("The ID of the user to unban.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("reason")
        .setDescription("Reason for the unban.")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const guild = interaction.guild;
    const moderator = interaction.user;

    const userId = interaction.options.getString("user_id");
    const reason = interaction.options.getString("reason") || "No reason provided.";

    // Try to unban
    try {
      await guild.members.unban(userId, reason);
    } catch (err) {
      return interaction.reply({
        content: "❌ That user is not banned or the ID is invalid.",
        ephemeral: true
      });
    }

    // Case ID system
    let caseData = db.prepare("SELECT last_case_id FROM case_ids WHERE guild_id = ?").get(guild.id);
    if (!caseData) {
      db.prepare("INSERT INTO case_ids (guild_id, last_case_id) VALUES (?, ?)").run(guild.id, 0);
      caseData = { last_case_id: 0 };
    }

    const newCaseId = caseData.last_case_id + 1;
    db.prepare("UPDATE case_ids SET last_case_id = ? WHERE guild_id = ?").run(newCaseId, guild.id);

    // Modlog
    const modlog = db.prepare("SELECT channel_id FROM modlog_settings WHERE guild_id = ?").get(guild.id);
    if (modlog && modlog.channel_id) {
      const logChannel = guild.channels.cache.get(modlog.channel_id);

      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle("🔓 Unban Action")
          .setColor("#4dff88")
          .addFields(
            { name: "User ID", value: userId },
            { name: "Moderator", value: `${moderator.tag} (${moderator.id})` },
            { name: "Reason", value: reason },
            { name: "Timestamp", value: new Date().toLocaleString() },
            { name: "Guild", value: guild.name }
          )
          .setFooter({ text: `Case #${newCaseId}` });

        await logChannel.send({ embeds: [embed] });
      }
    }

    return interaction.reply({
      content: `🔓 User **${userId}** has been unbanned.`,
      ephemeral: true
    });
  }
};
