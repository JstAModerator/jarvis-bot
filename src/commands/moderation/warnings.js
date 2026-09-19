import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, "../../database/warnings.db"));

export const data = new SlashCommandBuilder()
  .setName("warnings")
  .setDescription("View a user's warnings")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(opt =>
    opt.setName("user").setDescription("User to check").setRequired(true)
  );

export async function execute(interaction) {
  const user = interaction.options.getUser("user");

  const rows = db.prepare(`
    SELECT * FROM warnings
    WHERE guild_id = ? AND user_id = ?
    ORDER BY timestamp DESC
  `).all(interaction.guild.id, user.id);

  if (rows.length === 0) {
    return interaction.reply({
      content: `✅ **${user.tag}** has no warnings.`,
      ephemeral: true
    });
  }

  let list = rows
    .map(
      (w, i) =>
        `**${i + 1}.** ${new Date(w.timestamp).toLocaleString()} — ${w.reason} *(by <@${w.moderator_id}>)*`
    )
    .join("\n");

  await interaction.reply({
    content: `⚠️ **Warnings for ${user.tag}:**\n${list}`,
    ephemeral: false
  });
}
