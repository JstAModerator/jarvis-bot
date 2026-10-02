import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

import {
  getUser,
  addXP,
  setLastMessageTime,
  getRoleForLevel,
  isChannelBlacklisted,
} from "../database/xp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// READ-ONLY: is XP enabled for this guild?
// =====================================================

const settingsDbPath = path.join(__dirname, "..", "database", "settings.db");
const settingsDb = new Database(settingsDbPath, { fileMustExist: false });

function isXpEnabled(guildId) {
  try {
    const row = settingsDb
      .prepare(`SELECT xp_enabled FROM server_settings WHERE guild_id = ?`)
      .get(guildId);

    return row ? !!row.xp_enabled : true;
  } catch {
    return true;
  }
}

// =====================================================
// CONFIG
// =====================================================

const MESSAGE_COOLDOWN_MS = 60000;
const MESSAGE_XP_MIN = 15;
const MESSAGE_XP_MAX = 25;

const VOICE_XP_AMOUNT = 8;
const VOICE_XP_INTERVAL_MS = 60000;

function randomMessageXp() {
  return Math.floor(
    Math.random() * (MESSAGE_XP_MAX - MESSAGE_XP_MIN + 1) + MESSAGE_XP_MIN
  );
}

// =====================================================
// ROLE REWARDS (exported so /xp set|add|remove can reuse it)
// =====================================================

export async function syncLevelRoles(member, oldLevel, newLevel) {
  for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
    const roleId = getRoleForLevel(member.guild.id, lvl);
    if (!roleId) continue;

    const role = member.guild.roles.cache.get(roleId);
    if (!role) continue;

    try {
      await member.roles.add(role);
    } catch (error) {
      console.error("XP LEVEL ROLE ASSIGN ERROR:", error);
    }
  }
}

async function handleLevelUp(member, channel, result) {
  if (!result.leveledUp) return;

  const announceChannel =
    channel && channel.isTextBased() ? channel : member.guild.systemChannel;

  if (announceChannel) {
    announceChannel
      .send(`🎉 ${member} leveled up to **Level ${result.newLevel}**!`)
      .catch(() => {});
  }

  await syncLevelRoles(member, result.oldLevel, result.newLevel);
}

// =====================================================
// MESSAGE XP
// =====================================================

function registerMessageXp(client) {
  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (!isXpEnabled(message.guild.id)) return;
      if (isChannelBlacklisted(message.guild.id, message.channel.id)) return;

      const guildId = message.guild.id;
      const userId = message.author.id;

      const user = getUser(guildId, userId);
      const now = Date.now();

      if (now - user.last_message_at < MESSAGE_COOLDOWN_MS) return;

      setLastMessageTime(guildId, userId, now);

      const gained = randomMessageXp();
      const result = addXP(guildId, userId, gained);

      if (result.leveledUp) {
        const member =
          message.member ??
          (await message.guild.members.fetch(userId).catch(() => null));

        if (member) {
          await handleLevelUp(member, message.channel, result);
        }
      }
    } catch (error) {
      console.error("MESSAGE XP ERROR:", error);
    }
  });
}

// =====================================================
// VOICE XP
// =====================================================

function registerVoiceXp(client) {
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      if (!isXpEnabled(guild.id)) continue;

      const afkChannelId = guild.afkChannelId;

      for (const voiceState of guild.voiceStates.cache.values()) {
        const member = voiceState.member;

        if (!member || member.user.bot) continue;
        if (!voiceState.channelId) continue;
        if (voiceState.channelId === afkChannelId) continue;
        if (isChannelBlacklisted(guild.id, voiceState.channelId)) continue;

        const channel = voiceState.channel;
        const humanCount =
          channel?.members?.filter((m) => !m.user.bot).size ?? 0;

        if (humanCount < 2) continue;

        try {
          const result = addXP(guild.id, member.id, VOICE_XP_AMOUNT);

          if (result.leveledUp) {
            await handleLevelUp(member, null, result);
          }
        } catch (error) {
          console.error("VOICE XP ERROR:", error);
        }
      }
    }
  }, VOICE_XP_INTERVAL_MS);
}

// =====================================================
// EXPORT
// =====================================================

export function registerXpHandlers(client) {
  registerMessageXp(client);
  registerVoiceXp(client);
  console.log("✅ XP handlers registered (messages + voice)");
}