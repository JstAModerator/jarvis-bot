const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits
} = require("discord.js");

const db = require("../database"); // your sqlite wrapper

module.exports = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("View and edit Jarvis settings for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const guildId = interaction.guild.id;

    // Fetch settings from DB
    const settings = db.prepare("SELECT * FROM settings WHERE guild_id = ?").get(guildId) || {
      embed_color: "#8366ff",
      welcome_message: "Welcome to the server!",
      meme_source: "reddit",
      xp_enabled: 1,
      economy_enabled: 1
    };

    // MAIN EMBED
    const embed = new EmbedBuilder()
      .setTitle(`⚙️ Jarvis Settings — ${interaction.guild.name}`)
      .setColor(settings.embed_color)
      .setDescription("Manage your server’s settings directly inside Discord.\n\nUse the buttons or dropdown below.")
      .addFields(
        { name: "🎨 Embed Color", value: settings.embed_color, inline: true },
        { name: "👋 Welcome Message", value: settings.welcome_message, inline: true },
        { name: "🎭 Meme Source", value: settings.meme_source, inline: true },
        { name: "⭐ XP System", value: settings.xp_enabled ? "Enabled" : "Disabled", inline: true },
        { name: "💰 Economy", value: settings.economy_enabled ? "Enabled" : "Disabled", inline: true }
      );

    // BUTTONS
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_dashboard")
        .setLabel("Open Dashboard")
        .setStyle(ButtonStyle.Link)
        .setURL("https://jarvis-bot-fod2.onrender.com/dashboard"),

      new ButtonBuilder()
        .setCustomId("refresh_settings")
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Primary)
    );

    // DROPDOWN
    const dropdown = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("settings_menu")
        .setPlaceholder("Choose a setting to edit...")
        .addOptions(
          {
            label: "Change Embed Color",
            value: "embed_color"
          },
          {
            label: "Change Welcome Message",
            value: "welcome_message"
          },
          {
            label: "Change Meme Source",
            value: "meme_source"
          },
          {
            label: "Toggle XP System",
            value: "xp_toggle"
          },
          {
            label: "Toggle Economy",
            value: "economy_toggle"
          }
        )
    );

    await interaction.reply({
      embeds: [embed],
      components: [buttons, dropdown]
    });

    // COLLECTOR
    const collector = interaction.channel.createMessageComponentCollector({
      time: 60000
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id)
        return i.reply({ content: "This menu isn’t for you.", ephemeral: true });

      // Refresh button
      if (i.customId === "refresh_settings") {
        return i.update({ embeds: [embed], components: [buttons, dropdown] });
      }

      // Dropdown actions
      if (i.customId === "settings_menu") {
        const choice = i.values[0];

        // Change embed color
        if (choice === "embed_color") {
          return i.reply({
            content: "Send the new embed color (hex code, e.g. `#8366ff`).",
            ephemeral: true
          }).then(() => {
            const msgCollector = interaction.channel.createMessageCollector({
              filter: (m) => m.author.id === interaction.user.id,
              time: 30000
            });

            msgCollector.on("collect", (msg) => {
              db.prepare("UPDATE settings SET embed_color = ? WHERE guild_id = ?")
                .run(msg.content, guildId);

              msgCollector.stop();
              i.followUp({ content: "Embed color updated!", ephemeral: true });
            });
          });
        }

        // Change welcome message
        if (choice === "welcome_message") {
          return i.reply({
            content: "Send the new welcome message.",
            ephemeral: true
          }).then(() => {
            const msgCollector = interaction.channel.createMessageCollector({
              filter: (m) => m.author.id === interaction.user.id,
              time: 30000
            });

            msgCollector.on("collect", (msg) => {
              db.prepare("UPDATE settings SET welcome_message = ? WHERE guild_id = ?")
                .run(msg.content, guildId);

              msgCollector.stop();
              i.followUp({ content: "Welcome message updated!", ephemeral: true });
            });
          });
        }

        // Change meme source
        if (choice === "meme_source") {
          return i.reply({
            content: "Choose a meme source: `reddit`, `imgur`, or `tenor`.",
            ephemeral: true
          }).then(() => {
            const msgCollector = interaction.channel.createMessageCollector({
              filter: (m) => m.author.id === interaction.user.id,
              time: 30000
            });

            msgCollector.on("collect", (msg) => {
              db.prepare("UPDATE settings SET meme_source = ? WHERE guild_id = ?")
                .run(msg.content.toLowerCase(), guildId);

              msgCollector.stop();
              i.followUp({ content: "Meme source updated!", ephemeral: true });
            });
          });
        }

        // Toggle XP
        if (choice === "xp_toggle") {
          db.prepare("UPDATE settings SET xp_enabled = ? WHERE guild_id = ?")
            .run(settings.xp_enabled ? 0 : 1, guildId);

          return i.reply({ content: "XP system toggled!", ephemeral: true });
        }

        // Toggle Economy
        if (choice === "economy_toggle") {
          db.prepare("UPDATE settings SET economy_enabled = ? WHERE guild_id = ?")
            .run(settings.economy_enabled ? 0 : 1, guildId);

          return i.reply({ content: "Economy toggled!", ephemeral: true });
        }
      }
    });
  }
};
