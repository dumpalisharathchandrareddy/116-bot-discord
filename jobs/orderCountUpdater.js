const cron = require("node-cron");
const { PermissionFlagsBits, ChannelType } = require("discord.js");
const db = require("../db");

const CHANNEL_ID = process.env.ORDER_COUNT_CHANNEL_ID; // set in Railway

module.exports = (client) => {
  if (!CHANNEL_ID) {
    console.warn("ORDER_COUNT_CHANNEL_ID not set — daily orders rename disabled.");
    return;
  }

  // Every day at 10:00 AM America/New_York (EST/EDT)
  cron.schedule(
    "0 10 * * *",
    async () => {
      try {
        const { rows } = await db.query(
          `SELECT COALESCE(SUM(total_orders), 0) AS total FROM user_orders`
        );
        const total = rows[0]?.total ?? 0;
        const newName = `orders-${total}`;

        const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!ch || ch.type !== ChannelType.GuildText) return;

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
    },
    { timezone: "America/New_York" }
  );
};
