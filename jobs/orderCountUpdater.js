// job/orderCount.js
const cron = require("node-cron");
const { PermissionFlagsBits, ChannelType } = require("discord.js");
const db = require("../db");

const CHANNEL_ID = process.env.ORDER_COUNT_CHANNEL_ID; // voice or text channel id

async function renameOrdersChannel(client) {
  try {
    const { rows } = await db.query(
      `SELECT COALESCE(SUM(total_orders), 0) AS total FROM user_orders`
    );
    const total = rows[0]?.total ?? 0;
    const newName = `orders-${total}`;

    const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!ch) {
      console.warn("[orders-job] Channel not found:", CHANNEL_ID);
      return;
    }

    // Allow Text, Announcement, and Voice (no posting needed here, just rename)
    const isRenameableType =
      ch.type === ChannelType.GuildText ||
      ch.type === ChannelType.GuildAnnouncement ||
      ch.type === ChannelType.GuildVoice;

    if (!isRenameableType) {
      console.warn(`[orders-job] Unsupported channel type for ${CHANNEL_ID}:`, ch.type);
      return;
    }

    const me = await ch.guild.members.fetchMe();
    const canManage = ch.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels);
    if (!canManage) {
      console.warn(`[orders-job] Missing ManageChannels on ${CHANNEL_ID}`);
      return;
    }

    if (ch.name !== newName) {
      await ch.setName(newName);
      console.log(`[orders-job] Renamed #${ch.id} → ${newName}`);
    } else {
      console.log(`[orders-job] Already up-to-date: ${newName}`);
    }
  } catch (err) {
    console.error("[orders-job] Failed to update orders channel name:", err);
  }
}

module.exports = (client) => {
  if (!CHANNEL_ID) {
    console.warn("ORDER_COUNT_CHANNEL_ID not set — daily orders rename disabled.");
    return;
  }

  // Run once on ready (so you can verify right away)
  client.once("ready", () => {
    renameOrdersChannel(client);
  });

  // Run every day at 10:00 AM America/New_York
  cron.schedule("0 10 * * *", () => renameOrdersChannel(client), {
    timezone: "America/New_York",
  });
};
