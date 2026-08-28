import { SlashCommandBuilder } from "discord.js";

const symbols = [
  "🍒",
  "🍋",
  "🍇",
  "⭐",
  "💎",
  "🔥",
  "7️⃣"
];

export const data = new SlashCommandBuilder()
  .setName("slots")
  .setDescription("Spin the animated 7‑emoji slot machine!");

export async function execute(interaction) {
  await interaction.deferReply(); // allows animation

  // Generate animation frames
  const frames = [];
  for (let i = 0; i < 5; i++) {
    const frame = [
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)]
    ];
    frames.push(frame);
  }

  // Send first frame
  await interaction.editReply(`🎰 **Spinning...**\n${frames[0].join(" | ")}`);

  // Animate by editing the message
  for (let i = 1; i < frames.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 500)); // 0.5s delay
    await interaction.editReply(`🎰 **Spinning...**\n${frames[i].join(" | ")}`);
  }

  // Final spin result
  const final = frames[frames.length - 1];

  let result;
  if (final[0] === final[1] && final[1] === final[2]) {
    result = "🎉 **JACKPOT!** All three match!";
  } else if (final[0] === final[1] || final[1] === final[2] || final[0] === final[2]) {
    result = "✨ **Nice!** You got a pair!";
  } else {
    result = "😔 No match… better luck next time!";
  }

  await new Promise(resolve => setTimeout(resolve, 600));
  await interaction.editReply(`🎰 **Final Result**\n${final.join(" | ")}\n\n${result}`);
}
