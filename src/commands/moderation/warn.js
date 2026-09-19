import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, "../../database/warnings.db"));

db.prepare(`
  CREATE TABLE IF NOT EXISTS warnings (
    guild_id TEXT,
    user_id TEXT,
    moderator_id TEXT,
    reason TEXT,
    timestamp INTEGER
  )
`).run();

export const data = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Warn a member")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(opt =>
    opt.setName("user").setDescription("User to warn").setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName("reason").setDescription("Reason for the warning").setRequired(true)
  );

export async function execute(interaction) {
  const user = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason");

  db.prepare(`
    INSERT INTO warnings (guild_id, user_id, moderator_id, reason, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    interaction.guild.id,
    user.id,
    interaction.user.id,
    reason,
    Date.now()
  );

  await interaction.reply({
    content: `⚠️ **${user.tag}** has been warned.\nReason: **${reason}**`,
    ephemeral: false
  });
}
