import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadCommands(client) {
  const commandsPath = path.join(__dirname, "..", "commands");
  const commands = new Map();

  // Make sure commands directory exists
  if (!fs.existsSync(commandsPath)) {
    console.error(
      `❌ Commands folder not found: ${commandsPath}`
    );

    client.commands = commands;
    return commands;
  }

  async function readFolder(folderPath) {
    const items = fs.readdirSync(folderPath);

    for (const item of items) {
      const fullPath = path.join(folderPath, item);
      const stat = fs.statSync(fullPath);

      // Recursively search subfolders
      if (stat.isDirectory()) {
        await readFolder(fullPath);
        continue;
      }

      // Ignore anything that isn't JavaScript
      if (!item.endsWith(".js")) {
        continue;
      }

      try {
        // Convert filesystem path into a URL
        // so ESM dynamic import works correctly.
        const fileUrl = pathToFileURL(fullPath).href;

        const importedCommand = await import(fileUrl);

        // Commands should use:
        //
        // export default {
        //   data: ...,
        //   execute: ...
        // }
        //
        // This grabs that default export.
        const command = importedCommand.default;

        if (!command) {
          console.warn(
            `⚠️ Skipped ${item}: missing default export`
          );
          continue;
        }

        if (!command.data || !command.execute) {
          console.warn(
            `⚠️ Skipped invalid command file: ${item}`
          );
          continue;
        }

        commands.set(
          command.data.name,
          command
        );

        console.log(
          `✅ Loaded command: /${command.data.name}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to load command: ${item}`
        );

        console.error(error);
      }
    }
  }

  await readFolder(commandsPath);

  client.commands = commands;

  console.log(
    `✅ Loaded ${commands.size} commands (recursive)`
  );

  return commands;
}