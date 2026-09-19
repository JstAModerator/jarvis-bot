const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

const db = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user for a specific duration.")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("The user to timeout.")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("minutes")
        .setDescription("Duration in minutes.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("reason")
        .setDescription("Reason for the timeout.")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const guild = interaction.guild;
    const moderator = interaction.user;

    const target = interaction.options.getUser("user");
    const minutes = interaction.options.getInteger("minutes");
    const reason = interaction.options.getString("reason") || "No reason provided.";

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        content: "❌ I can't find that user.",
        ephemeral: true
      });
    }

    const ms = minutes * 60 * 1000;

    // DM user
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`⏳ You were timed out in ${guild.name}`)
        .addFields(
          { name: "Duration", value: `${minutes} minutes` },
          { name: "Reason", value: reason },
          { name: "Moderator", value: moderator.tag }
        )
        .setColor("#4da6ff");

      await target.send({ embeds: [dmEmbed] });
    } catch {}

    await member.timeout(ms, reason);

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
          .setTitle("⏳ Timeout Action")
          .setColor("#4da6ff")
          .addFields(
            { name: "User", value: `${target.tag} (${target.id})` },
            { name: "Moderator", value: `${moderator.tag} (${moderator.id})` },
            { name: "Duration", value: `${minutes} minutes` },
            { name: "Reason", value: reason },
            { name: "Timestamp", value: new Date().toLocaleString() },
            { name: "Guild", value: guild.name }
          )
          .setFooter({ text: `Case #${newCaseId}` });

        await logChannel.send({ embeds: [embed] });
      }
    }

    return interaction.reply({
      content: `⏳ **${target.tag}** has been timed out for ${minutes} minutes.`,
      ephemeral: true
    });
  }
};
