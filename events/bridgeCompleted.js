// events/bridgeCompleted.js
const { Events } = require("discord.js");

const UE_TRACKER_BOT_ID = process.env.UE_TRACKER_BOT_ID;   // <- set in .env
const BRIDGE_SECRET     = process.env.BRIDGE_SECRET;       // <- set in .env
const TICKET_CATEGORY_IDS = (process.env.TICKET_CATEGORY_IDS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

// in-memory dedupe (no storage)
const RECENT_WINDOW_MS = 10 * 60 * 1000;
const recent = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, t] of recent.entries()) if (now - t > RECENT_WINDOW_MS) recent.delete(k);
}, 60 * 1000);

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (!message.author?.bot) return;
      if (message.author.id !== UE_TRACKER_BOT_ID) return;

      if (TICKET_CATEGORY_IDS.length) {
        const parentId = message.channel?.parentId || null;
        if (!parentId || !TICKET_CATEGORY_IDS.includes(parentId)) return;
      }

      const text = message.content?.trim() || "";
      if (!text.startsWith("!completed ")) return;

      let data;
      try { data = JSON.parse(text.slice("!completed ".length)); } catch { return; }
      if (!BRIDGE_SECRET || data.secret !== BRIDGE_SECRET) return;

      const userId   = String(data.userId || "");
      const orderId  = String(data.orderId || "");
      const total    = Number(data.total || 0);
      const channelId = data.channelId || message.channel.id;
      if (!userId || !orderId) return;

      if (recent.has(orderId)) { await message.react("🟰").catch(() => {}); return; }
      recent.set(orderId, Date.now());

      // call /completed’s helper
      const cmd = message.client.commands.get("completed");
      if (cmd?.runDirect) {
        await cmd.runDirect(message.client, { userId, orderId, total, channelId });
        // debug
      console.log("[bridge] seen msg from", message.author.id, "content:", message.content?.slice(0, 30));

      }
      await message.react("✅").catch(() => {});
    } catch (e) {
      console.error("[bridgeCompleted] error:", e);
      await message.react("⚠️").catch(() => {});
    }
    await message.delete().catch(() => {});
  },
};
