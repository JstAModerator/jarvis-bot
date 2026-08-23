import { REST, Routes } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

// Import all commands
import { data as ping } from "./commands/ping.js";
import { data as meme } from "./commands/meme.js";
import { data as remind } from "./commands/remind.js";
import { data as calc } from "./commands/calc.js";
import { data as uptime } from "./commands/uptime.js";
import { data as botinfo } from "./commands/botinfo.js";
import { data as eightball } from "./commands/eightball.js";

const commands = [
  ping.toJSON(),
  meme.toJSON(),
  remind.toJSON(),
  calc.toJSON(),
  uptime.toJSON(),
  botinfo.toJSON(),
  eightball.toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function deploy() {
  try {
    console.log("Registering slash commands...");
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("Slash commands registered successfully!");
  } catch (error) {
    console.error(error);
  }
}

deploy();
