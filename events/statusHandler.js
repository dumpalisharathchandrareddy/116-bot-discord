const { EmbedBuilder, Events, PermissionFlagsBits, ChannelType } = require("discord.js");

// Rename BOTH (voice gets rename only)
const STATUS_RENAME_CHANNEL_IDS = [
  "1400619386964017314", // main text channel
  "1400623787816521949", // voice channel
];

// Post/Cleanup ONLY here (must be text-like)
const STATUS_POST_CHANNEL_IDS = [
  "1400619386964017314",
];

const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

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

      // Build new name + embed
      let newName = "";
      let statusEmbed = null;
      let mentionTag = "";

      if (keyword === "open") {
        newName = "🟢open🟢・status";
        mentionTag = "@everyone";
        statusEmbed = new EmbedBuilder()
          .setTitle("🟢 STATUS: NOW OPEN")
          .setDescription(
            `✅ **We are currently taking orders!**

**UE Promo Update**
UE has changed the offer to:
**$20 OFF on $20 subtotal**

> Add **exactly $20** to your cart to make full use of the promo.
> Less than $20 = no discount.

**Any store**

📦 Make multiple carts for large orders
📣 Expect a queue — respond to pings ASAP

🛒 Place your group order now!`
          )
          .setImage("https://media.giphy.com/media/BuixK83naJThKrTDXF/giphy.gif")
          .setColor(0x00ff66)
          .setFooter({ text: "Updated by Info Bot • OPEN for orders" })
          .setTimestamp();
      } else if (keyword === "busy") {
        newName = "🟠busy🟠・status";
        mentionTag = "@here";
        statusEmbed = new EmbedBuilder()
          .setTitle("🟠 STATUS: BUSY")
          .setDescription(
            `**⚠️ CURRENTLY PROCESSING ORDERS**
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
        newName = "🔴closed🔴・status";
        mentionTag = "@here";
        statusEmbed = new EmbedBuilder()
          .setTitle("🔴 STATUS: CLOSED")
          .setDescription(
            `**❌ CURRENTLY CLOSED**
No orders are being accepted.

**🕐 CHECK BACK LATER**  
🔔 Stay notified for updates!

🙏 Thanks for your patience.`
          )
          .setImage("https://media.tenor.com/znjmPw_FF3sAAAAC/close.gif")
          .setColor(0xff0000)
          .setFooter({ text: "Updated by 1 1 6  M A S T E R • Currently Closed" })
          .setTimestamp();
      }

      // React to trigger
      try { await message.react("✅"); } catch {}

      const me = await message.guild.members.fetchMe();

      for (const id of STATUS_RENAME_CHANNEL_IDS) {
        const ch = await message.guild.channels.fetch(id).catch(() => null);
        if (!ch) continue;

        const isTextLike =
          ch.type === ChannelType.GuildText ||
          ch.type === ChannelType.GuildAnnouncement ||
          ch.type === ChannelType.PublicThread;
        const isVoice = ch.type === ChannelType.GuildVoice;

        // Rename for both text and voice
        if (ch.manageable && ch.name !== newName) {
          try { await ch.setName(newName); }
          catch (e) { console.warn(`⚠️ setName failed for #${ch.id}:`, e?.message); }
        }

        // Only post in main text channel
        if (!STATUS_POST_CHANNEL_IDS.includes(id)) continue;
        if (!isTextLike) continue;

        const perms = ch.permissionsFor(me);
        const canSend =
          perms?.has(PermissionFlagsBits.ViewChannel) &&
          perms?.has(PermissionFlagsBits.SendMessages);

        if (!canSend) continue;

        // Cleanup last 50
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
