const fs = require("fs");
const path = require("path");

function loadCommands(client) {
  const commandsPath = path.join(__dirname, "..", "commands");
  const commands = new Map();

  function readFolder(folderPath) {
    const items = fs.readdirSync(folderPath);

    for (const item of items) {
      const fullPath = path.join(folderPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        readFolder(fullPath);
      } else if (item.endsWith(".js")) {
        const command = require(fullPath);

        if (!command.data || !command.execute) {
          console.warn(`⚠️ Skipped invalid command file: ${item}`);
          continue;
        }

        commands.set(command.data.name, command);
      }
    }
  }

  readFolder(commandsPath);

  client.commands = commands;
  console.log(`✅ Loaded ${commands.size} commands (recursive)`);

  return commands;
}

module.exports = { loadCommands };
