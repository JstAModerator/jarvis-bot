import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("remind")
  .setDescription("Set a reminder that will DM you.")
  .addStringOption(option =>
    option.setName("time")
      .setDescription("Time until reminder (e.g., 10s, 5m, 2h)")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("message")
      .setDescription("Reminder message")
      .setRequired(true)
  );

function parseTime(input) {
  const match = input.match(/(\d+)(s|m|h)/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  if (unit === "s") return value * 1000;
  if (unit === "m") return value * 60 * 1000;
  if (unit === "h") return value * 60 * 60 * 1000;

  return null;
}

export async function execute(interaction) {
  const timeInput = interaction.options.getString("time");
  const message = interaction.options.getString("message");

  const ms = parseTime(timeInput);
  if (!ms) {
    return interaction.reply("❌ Invalid time format. Use **10s**, **5m**, or **2h**.");
  }

  await interaction.reply(`⏳ Reminder set! I’ll DM you in **${timeInput}**.`);

  setTimeout(async () => {
    try {
      await interaction.user.send(`🔔 **Reminder:** ${message}`);
    } catch {
      await interaction.followUp("⚠️ I couldn't DM you. Your DMs might be closed.");
    }
  }, ms);
}
