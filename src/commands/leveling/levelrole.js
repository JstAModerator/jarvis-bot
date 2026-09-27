import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";

import {
  setLevelRole,
  removeLevelRole,
  getLevelRoles,
} from "../../database/xp.js";

const command = {
  data: new SlashCommandBuilder()
    .setName("levelrole")
    .setDescription("Manage level-up role rewards.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Assign a role reward for reaching a level.")
        .addIntegerOption((option) =>
          option
            .setName("level")
            .setDescription("Level required")
            .setRequired(true)
            .setMinValue(1)
        )
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("Role to grant")
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a level's role reward.")
        .addIntegerOption((option) =>
          option
            .setName("level")
            .setDescription("Level to clear")
            .setRequired(true)
            .setMinValue(1)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all configured level role rewards.")
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      const level = interaction.options.getInteger("level");
      const role = interaction.options.getRole("role");

      if (role.managed) {
        return interaction.reply({
          content: "❌ That role is managed by an integration and can't be assigned manually.",
          ephemeral: true,
        });
      }

      const botMember = guild.members.me;

      if (role.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: `❌ I can't assign ${role} — it's higher than or equal to my own highest role. Move my role above it.`,
          ephemeral: true,
        });
      }

      setLevelRole(guild.id, level, role.id);

      return interaction.reply({
        content: `✅ Members who reach **Level ${level}** will now receive ${role}.`,
        ephemeral: true,
      });
    }

    if (sub === "remove") {
      const level = interaction.options.getInteger("level");
      removeLevelRole(guild.id, level);

      return interaction.reply({
        content: `🗑️ Removed the role reward for Level ${level}.`,
        ephemeral: true,
      });
    }

    if (sub === "list") {
      const rows = getLevelRoles(guild.id);

      if (rows.length === 0) {
        return interaction.reply({
          content: "No level role rewards are configured yet.",
          ephemeral: true,
        });
      }

      const lines = rows.map((row) => {
        const role = guild.roles.cache.get(row.role_id);
        return `**Level ${row.level}** → ${
          role ? role.toString() : `Unknown Role (${row.role_id})`
        }`;
      });

      const embed = new EmbedBuilder()
        .setTitle("🎖️ Level Role Rewards")
        .setColor("#6a4cff")
        .setDescription(lines.join("\n"));

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default command;