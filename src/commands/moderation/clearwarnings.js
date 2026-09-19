import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, "../../database/warnings.db"));

export const data = new SlashCommandBuilder()
  .setName("clearwarnings")
  .setDescription("Clear all warnings for a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(opt =>
    opt.setName("user").setDescription("User to clear warnings for").setRequired(true)
  );

export async function execute(interaction) {
  const user = interaction.options.getUser("user");

  db.prepare(`
    DELETE FROM warnings
    WHERE guild_id = ? AND user_id = ?
  `).run(interaction.guild.id, user.id);

  await interaction.reply({
    content: `🧹 Cleared all warnings for **${user.tag}**.`,
    ephemeral: false
  });
}
