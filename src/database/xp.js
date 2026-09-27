import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "xp.db");

export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS xp_users (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    last_message_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS level_roles (
    guild_id TEXT NOT NULL,
    level INTEGER NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, level)
  );
`);

// =====================================================
// LEVEL MATH
// =====================================================

// XP required to go from `level` to `level + 1`
export function xpToNextLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

// Given total lifetime XP, derive the current level
export function calculateLevel(totalXp) {
  let level = 0;
  let remaining = totalXp;

  while (remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level);
    level++;
  }

  return level;
}

// XP earned so far *within* the current level (for progress bars)
export function xpIntoLevel(totalXp) {
  let level = 0;
  let remaining = totalXp;

  while (remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level);
    level++;
  }

  return remaining;
}

// =====================================================
// USER XP
// =====================================================

export function getUser(guildId, userId) {
  let row = db
    .prepare(`SELECT * FROM xp_users WHERE guild_id = ? AND user_id = ?`)
    .get(guildId, userId);

  if (!row) {
    db.prepare(`
      INSERT INTO xp_users (guild_id, user_id, xp, last_message_at)
      VALUES (?, ?, 0, 0)
    `).run(guildId, userId);

    row = { guild_id: guildId, user_id: userId, xp: 0, last_message_at: 0 };
  }

  return row;
}

// Adds XP and reports whether the user leveled up (and how far)
export function addXP(guildId, userId, amount) {
  const user = getUser(guildId, userId);

  const oldLevel = calculateLevel(user.xp);
  const newXp = user.xp + amount;
  const newLevel = calculateLevel(newXp);

  db.prepare(`
    UPDATE xp_users
    SET xp = ?
    WHERE guild_id = ? AND user_id = ?
  `).run(newXp, guildId, userId);

  return {
    leveledUp: newLevel > oldLevel,
    oldLevel,
    newLevel,
    xp: newXp,
  };
}

export function setLastMessageTime(guildId, userId, timestamp) {
  db.prepare(`
    UPDATE xp_users
    SET last_message_at = ?
    WHERE guild_id = ? AND user_id = ?
  `).run(timestamp, guildId, userId);
}

export function getLeaderboard(guildId, limit = 10) {
  return db
    .prepare(`
      SELECT user_id, xp
      FROM xp_users
      WHERE guild_id = ?
      ORDER BY xp DESC
      LIMIT ?
    `)
    .all(guildId, limit);
}

export function getRank(guildId, userId) {
  const rows = db
    .prepare(`
      SELECT user_id
      FROM xp_users
      WHERE guild_id = ?
      ORDER BY xp DESC
    `)
    .all(guildId);

  const index = rows.findIndex((r) => r.user_id === userId);
  return index === -1 ? null : index + 1;
}

// =====================================================
// LEVEL ROLES
// =====================================================

export function setLevelRole(guildId, level, roleId) {
  db.prepare(`
    INSERT INTO level_roles (guild_id, level, role_id)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id, level) DO UPDATE SET role_id = excluded.role_id
  `).run(guildId, level, roleId);
}

export function removeLevelRole(guildId, level) {
  db.prepare(`
    DELETE FROM level_roles WHERE guild_id = ? AND level = ?
  `).run(guildId, level);
}

export function getLevelRoles(guildId) {
  return db
    .prepare(`
      SELECT level, role_id FROM level_roles
      WHERE guild_id = ?
      ORDER BY level ASC
    `)
    .all(guildId);
}

export function getRoleForLevel(guildId, level) {
  const row = db
    .prepare(`
      SELECT role_id FROM level_roles
      WHERE guild_id = ? AND level = ?
    `)
    .get(guildId, level);

  return row ? row.role_id : null;
}