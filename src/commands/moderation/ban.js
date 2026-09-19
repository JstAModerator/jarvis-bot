const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const db = require("../../database"); // adjust path if needed

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server.")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("The user to ban.")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("reason")
        .setDescription("Reason for the ban.")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const moderator = interaction.user;
    const guild = interaction.guild;

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "No reason provided.";

    // Check if target is bannable
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        content: "❌ I can't find that user in the server.",
        ephemeral: true
      });
    }

    if (!member.bannable) {
      return interaction.reply({
        content: "❌ I cannot ban this user (role too high or insufficient permissions).",
        ephemeral: true
      });
    }

    // Confirmation buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_ban")
        .setLabel("Confirm Ban")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("cancel_ban")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );

    const confirmEmbed = new EmbedBuilder()
      .setTitle("🔨 Ban Confirmation")
      .setDescription(`Are you sure you want to ban **${target.tag}**?\n\n**Reason:** ${reason}`)
      .setColor("#ff4d4d");

    await interaction.reply({
      embeds: [confirmEmbed],
      components: [row],
      ephemeral: true
    });

    // Collector
    const collector = interaction.channel.createMessageComponentCollector({
      time: 30000
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== moderator.id) {
        return i.reply({ content: "❌ This confirmation isn't for you.", ephemeral: true });
      }

      if (i.customId === "cancel_ban") {
        return i.update({
          content: "❌ Ban cancelled.",
          embeds: [],
          components: []
        });
      }

      if (i.customId === "confirm_ban") {
        // DM the user
        try {
          const dmEmbed = new EmbedBuilder()
            .setTitle(`🔨 You were banned from ${guild.name}`)
            .addFields(
              { name: "Reason", value: reason },
              { name: "Moderator", value: moderator.tag }
            )
            .setColor("#ff4d4d");

          await target.send({ embeds: [dmEmbed] });
        } catch (err) {
          // DM failed — ignore
        }

        // Ban the user
        await member.ban({ reason });

        // Case ID system
        let caseData = db.prepare("SELECT last_case_id FROM case_ids WHERE guild_id = ?").get(guild.id);
        if (!caseData) {
          db.prepare("INSERT INTO case_ids (guild_id, last_case_id) VALUES (?, ?)").run(guild.id, 0);
          caseData = { last_case_id: 0 };
        }

        const newCaseId = caseData.last_case_id + 1;
        db.prepare("UPDATE case_ids SET last_case_id = ? WHERE guild_id = ?").run(newCaseId, guild.id);

        // Modlog channel
        const modlog = db.prepare("SELECT channel_id FROM modlog_settings WHERE guild_id = ?").get(guild.id);
        if (modlog && modlog.channel_id) {
          const logChannel = guild.channels.cache.get(modlog.channel_id);

          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle("🔨 Ban Action")
              .setColor("#ff4d4d")
              .addFields(
                { name: "User", value: `${target.tag} (${target.id})` },
                { name: "Moderator", value: `${moderator.tag} (${moderator.id})` },
                { name: "Reason", value: reason },
                { name: "Timestamp", value: new Date().toLocaleString() },
                { name: "Guild", value: guild.name }
              )
              .setFooter({ text: `Case #${newCaseId}` });

            await logChannel.send({ embeds: [logEmbed] });
          }
        }

        // Final moderator response
        return i.update({
          content: `🔨 **${target.tag}** has been banned.`,
          embeds: [],
          components: []
        });
      }
    });
  }
};
