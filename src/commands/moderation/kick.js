const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

const db = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server.")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("The user to kick.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("reason")
        .setDescription("Reason for the kick.")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const guild = interaction.guild;
    const moderator = interaction.user;

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "No reason provided.";

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        content: "❌ I can't find that user.",
        ephemeral: true
      });
    }

    if (!member.kickable) {
      return interaction.reply({
        content: "❌ I cannot kick this user.",
        ephemeral: true
      });
    }

    // DM user
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`👢 You were kicked from ${guild.name}`)
        .addFields(
          { name: "Reason", value: reason },
          { name: "Moderator", value: moderator.tag }
        )
        .setColor("#ff944d");

      await target.send({ embeds: [dmEmbed] });
    } catch {}

    await member.kick(reason);

    // Case ID
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
          .setTitle("👢 Kick Action")
          .setColor("#ff944d")
          .addFields(
            { name: "User", value: `${target.tag} (${target.id})` },
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
      content: `👢 **${target.tag}** has been kicked.`,
      ephemeral: true
    });
  }
};
