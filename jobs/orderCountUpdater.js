// job/orderCount.js
const cron = require("node-cron");
const { PermissionFlagsBits, ChannelType } = require("discord.js");
const db = require("../db");

const CHANNEL_ID = process.env.ORDER_COUNT_CHANNEL_ID; // voice or text channel id
const EMOJI = "🍲"; // change if you want a different vibe

// Map normal a–z to Unicode bold caps (Discord won't lowercase these)
function toBoldCaps(text) {
  const map = {
    a: "𝗔", b: "𝗕", c: "𝗖", d: "𝗗", e: "𝗘",
    f: "𝗙", g: "𝗚", h: "𝗛", i: "𝗜", j: "𝗝",
    k: "𝗞", l: "𝗟", m: "𝗠", n: "𝗡", o: "𝗢",
    p: "𝗣", q: "𝗤", r: "𝗥", s: "𝗦", t: "𝗧",
    u: "𝗨", v: "𝗩", w: "𝗪", x: "𝗫", y: "𝗬",
    z: "𝗭"
  };
  return text.split("").map(ch => map[ch.toLowerCase()] || ch).join("");
}

let lastName = "";
let lastRun = 0;
const DEBOUNCE_MS = 5000;

async function fetchTotalOrders() {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(total_orders), 0) AS total FROM user_orders`
  );
  return rows[0]?.total ?? 0;
}

async function renameOrdersChannel(client, force = false) {
  try {
    const now = Date.now();
    if (!force && now - lastRun < DEBOUNCE_MS) return;
    lastRun = now;

    const total = await fetchTotalOrders();
    const displayTotal = total + 100; // Always add +100
    const newName = `${EMOJI} ${toBoldCaps("ORDERS")} ${displayTotal}`;

    const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!ch) {
      console.warn("[orders-job] Channel not found:", CHANNEL_ID);
      return;
    }

    const isRenameableType = [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildVoice,
    ].includes(ch.type);
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

    if (ch.name !== newName && newName !== lastName) {
      await ch.setName(newName);
      lastName = newName;
      console.log(`[orders-job] Renamed #${ch.id} → ${newName}`);
    }
  } catch (err) {
    console.error("[orders-job] Failed to update orders channel name:", err);
  }
}

module.exports = (client) => {
  if (!CHANNEL_ID) {
    console.warn("ORDER_COUNT_CHANNEL_ID not set — orders rename disabled.");
    return;
  }

  client.once("ready", () => {
    renameOrdersChannel(client, true);
  });

  cron.schedule("0 10 * * *", () => renameOrdersChannel(client, true), {
    timezone: "America/New_York",
  });
};

module.exports.updateOrdersCount = async (client) => {
  await renameOrdersChannel(client, true);
};
