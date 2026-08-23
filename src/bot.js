import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

import { execute as pingExecute } from "./commands/ping.js";
import { execute as memeExecute } from "./commands/meme.js";
import { execute as remindExecute } from "./commands/remind.js";
import { execute as calcExecute } from "./commands/calc.js";
import { execute as uptimeExecute } from "./commands/uptime.js";
import { execute as botinfoExecute } from "./commands/botinfo.js";
import { execute as eightballExecute } from "./commands/eightball.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "ping") {
    await pingExecute(interaction);
  } else if (commandName === "meme") {
    await memeExecute(interaction);
  } else if (commandName === "remind") {
    await remindExecute(interaction);
  } else if (commandName === "calc") {
    await calcExecute(interaction);
  } else if (commandName === "uptime") {
    await uptimeExecute(interaction);
  } else if (commandName === "botinfo") {
    await botinfoExecute(interaction);
  } else if (commandName === "eightball") {
    await eightballExecute(interaction);
  }
});

client.login(process.env.DISCORD_TOKEN);

const app = express();

app.get("/", (req, res) => {
  res.send("Jarvis is alive!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express keep-alive server running on port ${PORT}`);
});