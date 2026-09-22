import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "moderation.db");

export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS case_ids (
    guild_id TEXT PRIMARY KEY,
    last_case_id INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS modlog_settings (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT
  );
`);

// Returns the next case number for this guild (1, 2, 3...)
// and persists it, so every moderation command sharing this
// db pulls from the same per-guild counter.
export function getNextCaseId(guildId) {
  let caseData = db
    .prepare(`
      SELECT last_case_id
      FROM case_ids
      WHERE guild_id = ?
    `)
    .get(guildId);

  if (!caseData) {
    db.prepare(`
      INSERT INTO case_ids (guild_id, last_case_id)
      VALUES (?, ?)
    `).run(guildId, 0);

    caseData = { last_case_id: 0 };
  }

  const newCaseId = caseData.last_case_id + 1;

  db.prepare(`
    UPDATE case_ids
    SET last_case_id = ?
    WHERE guild_id = ?
  `).run(newCaseId, guildId);

  return newCaseId;
}

export function getModlogChannel(guildId) {
  const row = db
    .prepare(`
      SELECT channel_id
      FROM modlog_settings
      WHERE guild_id = ?
    `)
    .get(guildId);

  return row ? row.channel_id : null;
}