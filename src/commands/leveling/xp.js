import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";

import {
  getUser,
  setXP,
  calculateLevel,
} from "../../database/xp.js";

import { syncLevelRoles } from "../../handlers/xpHandler.js";

const command = {
  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Manually manage a user's XP.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set a user's XP to an exact value.")
        .addUserOption((option) =>
          option.setName("user").setDescription("Target user").setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("amount")
            .setDescription("New total XP")
            .setRequired(true)
            .setMinValue(0)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add XP to a user.")
        .addUserOption((option) =>
          option.setName("user").setDescription("Target user").setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("amount")
            .setDescription("XP to add")
            .setRequired(true)
            .setMinValue(1)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove XP from a user.")
        .addUserOption((option) =>
          option.setName("user").setDescription("Target user").setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("amount")
            .setDescription("XP to remove")
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    const member = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return interaction.reply({
        content: "❌ I can't find that user in this server.",
        ephemeral: true,
      });
    }

    const current = getUser(guild.id, targetUser.id);
    const oldLevel = calculateLevel(current.xp);

    let newXp;

    if (sub === "set") {
      newXp = amount;
    } else if (sub === "add") {
      newXp = current.xp + amount;
    } else {
      newXp = current.xp - amount;
    }

    const finalXp = setXP(guild.id, targetUser.id, newXp);
    const newLevel = calculateLevel(finalXp);

    // Assign any role rewards for levels crossed upward.
    // (Levels lost from /xp remove don't auto-revoke roles —
    // that's a judgment call left to staff to handle manually.)
    if (newLevel > oldLevel) {
      await syncLevelRoles(member, oldLevel, newLevel);
    }

    const embed = new EmbedBuilder()
      .setTitle("🛠️ XP Adjusted")
      .setColor("#6a4cff")
      .addFields(
        { name: "User", value: `${targetUser.tag}`, inline: true },
        { name: "New Total XP", value: `${finalXp}`, inline: true },
        { name: "Level", value: `${oldLevel} → ${newLevel}`, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;