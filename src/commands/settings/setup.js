const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Automatically sets up roles and channels for the server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guild = interaction.guild;

    // =====================================================
    // BASIC CHECKS
    // =====================================================

    if (!guild) {
      return interaction.reply({
        content: "❌ This command can only be used inside a server.",
        ephemeral: true,
      });
    }

    // =====================================================
    // CONFIRMATION SCREEN
    // Nothing is created before confirmation.
    // =====================================================

    const previewEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("⚙️ Jarvis Server Setup")
      .setDescription(
        "**Jarvis is ready to configure this server.**\n\n" +
        "Nothing has been changed yet. Review the setup below."
      )
      .addFields(
        {
          name: "👑 Staff / Core Roles",
          value:
            "• Owner\n" +
            "• Bots\n" +
            "• Head Moderator\n" +
            "• Moderator\n" +
            "• Member",
          inline: true,
        },
        {
          name: "🎨 Color Roles",
          value:
            "• Red\n" +
            "• Yellow\n" +
            "• Blue\n" +
            "• Green\n" +
            "• Turquoise",
          inline: true,
        },
        {
          name: "🔔 Ping Roles",
          value:
            "• Game Night Pings\n" +
            "• Question of the Day Pings\n" +
            "• Revive Pings\n" +
            "• Giveaway Pings\n" +
            "• Announcement Pings\n" +
            "• Updates Pings",
          inline: true,
        },
        {
          name: "✨ Extra Roles",
          value:
            "• Muted\n" +
            "• Booster\n" +
            "• Event Winner",
          inline: true,
        },
        {
          name: "📁 Categories",
          value:
            "📌 INFORMATION\n" +
            "💬 COMMUNITY\n" +
            "🎉 EVENTS\n" +
            "🔊 VOICE\n" +
            "🛡️ STAFF",
          inline: true,
        },
        {
          name: "🔒 Permissions",
          value:
            "Jarvis will configure staff permissions, private staff channels, muted restrictions, and the role hierarchy.",
        }
      )
      .setFooter({
        text: "Nothing happens until you press Confirm Setup",
      })
      .setTimestamp();

    const confirmId = `setup-confirm-${interaction.id}`;
    const cancelId = `setup-cancel-${interaction.id}`;

    const confirmButton = new ButtonBuilder()
      .setCustomId(confirmId)
      .setLabel("Confirm Setup")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId(cancelId)
      .setLabel("Cancel")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger);

    const confirmationRow = new ActionRowBuilder().addComponents(
      confirmButton,
      cancelButton
    );

    let response;

    try {
      response = await interaction.reply({
        embeds: [previewEmbed],
        components: [confirmationRow],
        ephemeral: true,
        fetchReply: true,
      });
    } catch (error) {
      console.error("SETUP CONFIRMATION ERROR:", error);
      return;
    }

    // =====================================================
    // WAIT FOR BUTTON
    // =====================================================

    let buttonInteraction;

    try {
      buttonInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,

        filter: (button) =>
          button.user.id === interaction.user.id &&
          (button.customId === confirmId ||
            button.customId === cancelId),

        time: 60_000,
      });
    } catch (error) {
      // No button was pressed within 60 seconds.

      const expiredEmbed = new EmbedBuilder()
        .setColor("#747F8D")
        .setTitle("⌛ Setup Expired")
        .setDescription(
          "The setup confirmation expired.\n\n" +
          "No server changes were made. Run `/setup` again when you're ready."
        )
        .setFooter({
          text: "Jarvis Server Setup",
        });

      try {
        await interaction.editReply({
          embeds: [expiredEmbed],
          components: [],
        });
      } catch (editError) {
        console.error("SETUP TIMEOUT EDIT ERROR:", editError);
      }

      return;
    }

    // =====================================================
    // CANCEL
    // =====================================================

    if (buttonInteraction.customId === cancelId) {
      const cancelledEmbed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("❌ Setup Cancelled")
        .setDescription(
          "Server setup was cancelled.\n\n" +
          "**No changes were made.**"
        )
        .setFooter({
          text: "Jarvis Server Setup",
        })
        .setTimestamp();

      await buttonInteraction.update({
        embeds: [cancelledEmbed],
        components: [],
      });

      return;
    }

    // =====================================================
    // CONFIRMED
    // =====================================================

    const settingUpEmbed = new EmbedBuilder()
      .setColor("#FEE75C")
      .setTitle("⚙️ Setting Up Server...")
      .setDescription(
        "Jarvis is configuring the server.\n\n" +
        "🔄 Creating roles\n" +
        "🔄 Configuring permissions\n" +
        "🔄 Creating categories\n" +
        "🔄 Creating channels\n" +
        "🔄 Organizing hierarchy"
      )
      .setFooter({
        text: "Jarvis Server Setup",
      });

    await buttonInteraction.update({
      embeds: [settingUpEmbed],
      components: [],
    });

    // =====================================================
    // BEGIN SERVER SETUP
    // =====================================================

    try {
      // ===================================================
      // ROLE CONFIGURATION
      // ===================================================

      const roleConfigs = [
        {
          name: "Owner",
          color: "#FFD700",
          permissions: [
            PermissionFlagsBits.Administrator,
          ],
          hoist: true,
        },

        {
          name: "Bots",
          color: "#3498DB",
          permissions: [],
          hoist: true,
        },

        {
          name: "Head Moderator",
          color: "#D32F2F",
          permissions: [
            PermissionFlagsBits.ViewAuditLog,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.ModerateMembers,
            PermissionFlagsBits.ManageNicknames,
          ],
          hoist: true,
        },

        {
          name: "Moderator",
          color: "#F1C40F",
          permissions: [
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.ModerateMembers,
            PermissionFlagsBits.ManageNicknames,
          ],
          hoist: true,
        },

        {
          name: "Member",
          color: null,
          permissions: [],
        },

        // ===============================================
        // COSMETIC COLORS
        //
        // Staff colors intentionally use different shades.
        // ===============================================

        {
          name: "Red",
          color: "#FF5252",
          permissions: [],
        },

        {
          name: "Yellow",
          color: "#FFF176",
          permissions: [],
        },

        {
          name: "Blue",
          color: "#5865F2",
          permissions: [],
        },

        {
          name: "Green",
          color: "#2ECC71",
          permissions: [],
        },

        {
          name: "Turquoise",
          color: "#1ABC9C",
          permissions: [],
        },

        // ===============================================
        // PING ROLES
        // ===============================================

        {
          name: "Game Night Pings",
          color: null,
          permissions: [],
          mentionable: true,
        },

        {
          name: "Question of the Day Pings",
          color: null,
          permissions: [],
          mentionable: true,
        },

        {
          name: "Revive Pings",
          color: null,
          permissions: [],
          mentionable: true,
        },

        {
          name: "Giveaway Pings",
          color: null,
          permissions: [],
          mentionable: true,
        },

        {
          name: "Announcement Pings",
          color: null,
          permissions: [],
          mentionable: true,
        },

        {
          name: "Updates Pings",
          color: null,
          permissions: [],
          mentionable: true,
        },

        // ===============================================
        // EXTRA
        // ===============================================

        {
          name: "Muted",
          color: "#808080",
          permissions: [],
        },

        {
          name: "Booster",
          color: "#F47FFF",
          permissions: [],
          hoist: true,
        },

        {
          name: "Event Winner",
          color: "#FF8C00",
          permissions: [],
          hoist: true,
        },
      ];

      const roles = {};

      const createdRoles = [];
      const existingRoles = [];

      // ===================================================
      // CREATE / FIND ROLES
      // ===================================================

      for (const roleConfig of roleConfigs) {
        let role = guild.roles.cache.find(
          (r) =>
            r.name.toLowerCase() ===
            roleConfig.name.toLowerCase()
        );

        if (!role) {
          role = await guild.roles.create({
            name: roleConfig.name,

            color:
              roleConfig.color || undefined,

            permissions:
              roleConfig.permissions,

            hoist:
              roleConfig.hoist || false,

            mentionable:
              roleConfig.mentionable || false,

            reason:
              "Jarvis automatic server setup",
          });

          createdRoles.push(roleConfig.name);
        } else {
          existingRoles.push(roleConfig.name);
        }

        roles[roleConfig.name] = role;
      }

      // ===================================================
      // ROLE HIERARCHY
      // ===================================================

      const hierarchy = [
        "Owner",
        "Bots",
        "Head Moderator",
        "Moderator",
        "Booster",
        "Event Winner",

        "Red",
        "Yellow",
        "Blue",
        "Green",
        "Turquoise",

        "Game Night Pings",
        "Question of the Day Pings",
        "Revive Pings",
        "Giveaway Pings",
        "Announcement Pings",
        "Updates Pings",

        "Member",
        "Muted",
      ];

      // Position the roles ABOVE @everyone while keeping
      // staff higher than cosmetic/member roles.
      //
      // We reverse the hierarchy here because Discord
      // positions increase upward from @everyone.

      const reversedHierarchy = [...hierarchy].reverse();

      for (
        let index = 0;
        index < reversedHierarchy.length;
        index++
      ) {
        const roleName = reversedHierarchy[index];
        const role = roles[roleName];

        if (!role || !role.editable) {
          continue;
        }

        try {
          await role.setPosition(index + 1);
        } catch (error) {
          console.log(
            `Could not reposition ${roleName}:`,
            error.message
          );
        }
      }

      // ===================================================
      // CHANNEL HELPERS
      // ===================================================

      const createdChannels = [];
      const existingChannels = [];

      async function getOrCreateCategory(name) {
        let category =
          guild.channels.cache.find(
            (channel) =>
              channel.type ===
                ChannelType.GuildCategory &&
              channel.name === name
          );

        if (!category) {
          category =
            await guild.channels.create({
              name,
              type:
                ChannelType.GuildCategory,
              reason:
                "Jarvis automatic server setup",
            });

          createdChannels.push(name);
        } else {
          existingChannels.push(name);
        }

        return category;
      }

      async function getOrCreateTextChannel(
        name,
        parent,
        permissionOverwrites = []
      ) {
        let channel =
          guild.channels.cache.find(
            (channel) =>
              channel.type ===
                ChannelType.GuildText &&
              channel.name === name
          );

        if (!channel) {
          channel =
            await guild.channels.create({
              name,

              type:
                ChannelType.GuildText,

              parent:
                parent.id,

              permissionOverwrites,

              reason:
                "Jarvis automatic server setup",
            });

          createdChannels.push(`#${name}`);
        } else {
          existingChannels.push(`#${name}`);
        }

        return channel;
      }

      async function getOrCreateVoiceChannel(
        name,
        parent,
        permissionOverwrites = []
      ) {
        let channel =
          guild.channels.cache.find(
            (channel) =>
              channel.type ===
                ChannelType.GuildVoice &&
              channel.name === name
          );

        if (!channel) {
          channel =
            await guild.channels.create({
              name,

              type:
                ChannelType.GuildVoice,

              parent:
                parent.id,

              permissionOverwrites,

              reason:
                "Jarvis automatic server setup",
            });

          createdChannels.push(name);
        } else {
          existingChannels.push(name);
        }

        return channel;
      }

      // ===================================================
      // PERMISSION PRESETS
      // ===================================================

      const everyoneId =
        guild.roles.everyone.id;

      // -----------------------------------------------
      // Read-only information channels
      // -----------------------------------------------

      const memberReadOnly = [
        {
          id: everyoneId,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
          ],

          deny: [
            PermissionFlagsBits.SendMessages,
          ],
        },

        {
          id: roles["Member"].id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
          ],

          deny: [
            PermissionFlagsBits.SendMessages,
          ],
        },
      ];

      // -----------------------------------------------
      // Normal community channels
      // -----------------------------------------------

      const normalCommunity = [
        {
          id: everyoneId,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },

        {
          id: roles["Member"].id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AddReactions,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },

        {
          id: roles["Muted"].id,

          deny: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AddReactions,
            PermissionFlagsBits.AttachFiles,
          ],
        },
      ];

      // -----------------------------------------------
      // Staff text channels
      // -----------------------------------------------

      const staffOnly = [
        {
          id: everyoneId,

          deny: [
            PermissionFlagsBits.ViewChannel,
          ],
        },

        {
          id: roles["Owner"].id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },

        {
          id: roles["Head Moderator"].id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },

        {
          id: roles["Moderator"].id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ];

      // -----------------------------------------------
      // Staff voice
      // -----------------------------------------------

      const staffVoice = [
        {
          id: everyoneId,

          deny: [
            PermissionFlagsBits.ViewChannel,
          ],
        },

        {
          id: roles["Owner"].id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        },

        {
          id: roles["Head Moderator"].id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        },

        {
          id: roles["Moderator"].id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        },
      ];

      // ===================================================
      // INFORMATION
      // ===================================================

      const information =
        await getOrCreateCategory(
          "📌 INFORMATION"
        );

      await getOrCreateTextChannel(
        "welcome",
        information,
        memberReadOnly
      );

      await getOrCreateTextChannel(
        "rules",
        information,
        memberReadOnly
      );

      await getOrCreateTextChannel(
        "announcements",
        information,
        memberReadOnly
      );

      await getOrCreateTextChannel(
        "roles",
        information,
        memberReadOnly
      );

      // ===================================================
      // COMMUNITY
      // ===================================================

      const community =
        await getOrCreateCategory(
          "💬 COMMUNITY"
        );

      await getOrCreateTextChannel(
        "general",
        community,
        normalCommunity
      );

      await getOrCreateTextChannel(
        "media",
        community,
        normalCommunity
      );

      await getOrCreateTextChannel(
        "bot-commands",
        community,
        normalCommunity
      );

      await getOrCreateTextChannel(
        "questions",
        community,
        normalCommunity
      );

      await getOrCreateTextChannel(
        "memes",
        community,
        normalCommunity
      );

      // ===================================================
      // EVENTS
      // ===================================================

      const events =
        await getOrCreateCategory(
          "🎉 EVENTS"
        );

      await getOrCreateTextChannel(
        "game-night",
        events,
        normalCommunity
      );

      await getOrCreateTextChannel(
        "question-of-the-day",
        events,
        normalCommunity
      );

      await getOrCreateTextChannel(
        "revive-chat",
        events,
        normalCommunity
      );

      // ===================================================
      // VOICE
      // ===================================================

      const voice =
        await getOrCreateCategory(
          "🔊 VOICE"
        );

      await getOrCreateVoiceChannel(
        "General",
        voice
      );

      await getOrCreateVoiceChannel(
        "Gaming",
        voice
      );

      const afkChannel =
        await getOrCreateVoiceChannel(
          "AFK",
          voice
        );

      try {
        await guild.setAFKChannel(
          afkChannel,
          "Jarvis automatic server setup"
        );
      } catch (error) {
        console.log(
          "Could not set AFK channel:",
          error.message
        );
      }

      // ===================================================
      // STAFF
      // ===================================================

      const staff =
        await getOrCreateCategory(
          "🛡️ STAFF"
        );

      await getOrCreateTextChannel(
        "staff-chat",
        staff,
        staffOnly
      );

      await getOrCreateTextChannel(
        "mod-logs",
        staff,
        staffOnly
      );

      await getOrCreateTextChannel(
        "reports",
        staff,
        staffOnly
      );

      await getOrCreateVoiceChannel(
        "Staff VC",
        staff,
        staffVoice
      );

      // ===================================================
      // SETUP COMPLETE
      // ===================================================

      const completedEmbed =
        new EmbedBuilder()
          .setColor("#57F287")
          .setTitle(
            "✅ Jarvis Server Setup Complete"
          )
          .setDescription(
            "Jarvis finished configuring the server."
          )
          .addFields(
            {
              name: "🎭 Roles",
              value:
                `Created: **${createdRoles.length}**\n` +
                `Already existed: **${existingRoles.length}**`,
              inline: true,
            },

            {
              name: "📁 Channels / Categories",
              value:
                `Created: **${createdChannels.length}**\n` +
                `Already existed: **${existingChannels.length}**`,
              inline: true,
            },

            {
              name: "🛡️ Staff",
              value:
                "Owner, Head Moderator, and Moderator access configured.",
            },

            {
              name: "🎨 Colors",
              value:
                "Red • Yellow • Blue • Green • Turquoise",
            },

            {
              name: "🔔 Ping Roles",
              value:
                "Game Night • QOTD • Revive • Giveaway • Announcements • Updates",
            }
          )
          .setFooter({
            text:
              "Server configured by Jarvis",
          })
          .setTimestamp();

      await interaction.editReply({
        embeds: [completedEmbed],
        components: [],
      });

    } catch (error) {
      // =================================================
      // SETUP ERROR
      // =================================================

      console.error(
        "SETUP COMMAND ERROR:",
        error
      );

      const errorMessage =
        error?.message ||
        "Unknown setup error";

      const errorEmbed =
        new EmbedBuilder()
          .setColor("#ED4245")
          .setTitle(
            "❌ Jarvis Setup Failed"
          )
          .setDescription(
            "Jarvis couldn't finish the server setup.\n\n" +
            `**Error:**\n\`${errorMessage}\`\n\n` +
            "Check Jarvis's Discord permissions and role position."
          )
          .setFooter({
            text:
              "Some items may have been created before the error occurred.",
          })
          .setTimestamp();

      try {
        await interaction.editReply({
          embeds: [errorEmbed],
          components: [],
        });
      } catch (replyError) {
        console.error(
          "SETUP ERROR RESPONSE FAILED:",
          replyError
        );
      }
    }
  },
};