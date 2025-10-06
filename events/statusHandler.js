const { EmbedBuilder, Events, PermissionFlagsBits, ChannelType } = require("discord.js");

// Rename BOTH (voice gets rename only)
const STATUS_RENAME_CHANNEL_IDS = [
  "1405983227591790725", // main text channel
  "1405985956728668310", // voice channel
];

// Post/Cleanup ONLY here (must be text-like)
const STATUS_POST_CHANNEL_IDS = [
  "1405983227591790725",
];

const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

// Map normal a–z to Unicode bold caps so Discord won't lowercase them
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

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (GUILD_ID && message.guild.id !== GUILD_ID) return;

      // Must mention the bot
      const isMentioningBot =
        message.mentions.users.has(client.user.id) ||
        message.content.includes(`<@${client.user.id}>`) ||
        message.content.includes(`<@!${client.user.id}>`);
      if (!isMentioningBot) return;

      // Must include a keyword
      const lower = message.content.toLowerCase();
      const keyword = ["open", "busy", "closed"].find(w => lower.includes(w));
      if (!keyword) return;

      // Must be staff
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      const isStaff = STAFF_ROLE_ID ? member?.roles.cache.has(STAFF_ROLE_ID) : false;
      if (!isStaff) return;

      // Build new name (BOLD CAPS) + embed + mention tag
      let newName = "";
      let statusEmbed = null;
      let mentionTag = "@here";

      if (keyword === "open") {
        newName = `🟢 ${toBoldCaps("OPEN")} ・ status`;
        mentionTag = "@everyone";
        statusEmbed = new EmbedBuilder()
          .setTitle("🟢 STATUS: NOW OPEN")
          .setDescription(
            `✅ **We are currently taking orders!**

**GAME (0rder) Promo Update**
GAME offers:
**$20 OFF on $20 subtotal** (Any Store)        - #$5.5 fee + taxes
**$25 OFF on Any subtotal** (Selected Stores)  - #$8.0 fee + taxes

📦 Make multiple LINKS for large GAMES (0rders)
📣 Expect a queue — respond to pings ASAP

🛒 Place your group GAME (0rder) now!`
          )
          .setImage("https://media.giphy.com/media/BuixK83naJThKrTDXF/giphy.gif")
          .setColor(0x00ff66)
          .setFooter({ text: "Updated by Info Bot • OPEN for orders" })
          .setTimestamp();
      } else if (keyword === "busy") {
        newName = `🟠 ${toBoldCaps("BUSY")} ・ status`;
        mentionTag = "@here";
        statusEmbed = new EmbedBuilder()
          .setTitle("🟠 STATUS: BUSY")
          .setDescription(
            `**⚠️ CURRENTLY PROCESSING GAMES-:0RDERS**
_May be a slight delay_

**💬 PLEASE BE PATIENT**  
Avoid spam, we will respond ASAP

❤️ Thank you for your support!`
          )
          .setImage("https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif")
          .setColor(0xffa500)
          .setFooter({ text: "Updated by Info Bot • Currently Busy" })
          .setTimestamp();
      } else {
        newName = `🔴 ${toBoldCaps("CLOSED")} ・ status`;
        mentionTag = "@here";
        statusEmbed = new EmbedBuilder()
          .setTitle("🔴 STATUS: CLOSED")
          .setDescription(
            `**❌ CURRENTLY CLOSED**
No GAMES (0rders) are being accepted.

**🕐 CHECK BACK LATER**  
🔔 Stay notified for updates!

🙏 Thanks for your patience.`
          )
          .setImage("https://media.tenor.com/znjmPw_FF3sAAAAC/close.gif")
          .setColor(0xff0000)
          .setFooter({ text: "Updated by 1 1 6  M A S T E R • Currently Closed" })
          .setTimestamp();
      }

      // React to trigger (best effort)
      try { await message.react("✅"); } catch {}

      const me = await message.guild.members.fetchMe();

      for (const id of STATUS_RENAME_CHANNEL_IDS) {
        const ch = await message.guild.channels.fetch(id).catch(() => null);
        if (!ch) continue;

        const isTextLike =
          ch.type === ChannelType.GuildText ||
          ch.type === ChannelType.GuildAnnouncement;
        const isVoice = ch.type === ChannelType.GuildVoice;

        // Rename for both text and voice
        if (ch.manageable && ch.name !== newName) {
          try { await ch.setName(newName); }
          catch (e) { console.warn(`⚠️ setName failed for #${ch.id}:`, e?.message); }
        }

        // Only post/cleanup in main text channel
        if (!STATUS_POST_CHANNEL_IDS.includes(id)) continue;
        if (!isTextLike) continue;

        const perms = ch.permissionsFor(me);
        const canSend =
          perms?.has(PermissionFlagsBits.ViewChannel) &&
          perms?.has(PermissionFlagsBits.SendMessages);
        if (!canSend) continue;

        // Cleanup last 50 (bot/author)
        try {
          const msgs = await ch.messages.fetch({ limit: 50 });
          const deletable = msgs.filter(
            m => m.author.id === client.user.id || m.author.id === message.author.id
          );
          for (const m of deletable.values()) {
            await m.delete().catch(() => {});
          }
        } catch (e) {
          console.warn(`⚠️ Cleanup failed in #${ch.id}:`, e?.message);
        }

        // Send embed with mention
        try {
          await ch.send({ content: mentionTag, embeds: [statusEmbed] });
        } catch (e) {
          console.warn(`⚠️ Send failed in #${ch.id}:`, e?.message);
        }
      }
    } catch (err) {
      console.error("status updater error:", err);
    }
  },
};
