const { EmbedBuilder, Events, PermissionFlagsBits, ChannelType } = require("discord.js");

// Rename BOTH of these (in order):
const STATUS_RENAME_CHANNEL_IDS = [
  "1400619386964017314", // main channel (rename + post/cleanup)
  "1400623787816521949", // mirror channel (rename only)
];

// Post/Cleanup ONLY in these (primary list):
const STATUS_POST_CHANNEL_IDS = [
  "1400619386964017314", // ✅ only this one gets embed + cleanup
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

      // Must include one of the keywords
      const lower = message.content.toLowerCase();
      const keyword = ["open", "busy", "closed"].find((w) => lower.includes(w));
      if (!keyword) return;

      // Must be staff
      const member = await message.guild.members
        .fetch(message.author.id)
        .catch(() => null);
      const isStaff = STAFF_ROLE_ID ? member?.roles.cache.has(STAFF_ROLE_ID) : false;
      if (!isStaff) return;

      // Build new name + embed
      let newName = "";
      let statusEmbed = null;

      if (keyword === "open") {
        newName = "🟢open🟢・status";
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

      // React to the trigger (best effort)
      try {
        await message.react("✅");
      } catch {}

      const me = await message.guild.members.fetchMe();

      for (const id of STATUS_RENAME_CHANNEL_IDS) {
        const ch = await message.guild.channels.fetch(id).catch(() => null);
        if (!ch) continue;
        if (ch.type !== ChannelType.GuildText) continue;

        const perms = ch.permissionsFor(me);
        const canRename = ch.manageable; // Manage Channels
        const canSend =
          perms?.has(PermissionFlagsBits.SendMessages) &&
          perms?.has(PermissionFlagsBits.ViewChannel);

        // Always try to rename (if allowed)
        if (canRename && ch.name !== newName) {
          try {
            await ch.setName(newName);
          } catch (e) {
            console.warn(`⚠️ setName failed for #${ch.id}:`, e?.message);
          }
        }

        // Only post/cleanup in primary channels
        if (!STATUS_POST_CHANNEL_IDS.includes(id)) continue;
        if (!canSend) continue;

        // Cleanup only in posting channels
        try {
          const msgs = await ch.messages.fetch({ limit: 50 });
          const deletable = msgs.filter(
            (m) => m.author.id === client.user.id || m.author.id === message.author.id
          );
          for (const m of deletable.values()) {
            await m.delete().catch(() => {});
          }
        } catch (e) {
          console.warn(`⚠️ Cleanup failed in #${ch.id}:`, e?.message);
        }

        // Post the embed
        try {
          await ch.send({ content: "@everyone", embeds: [statusEmbed] });
        } catch (e) {
          console.warn(`⚠️ Send failed in #${ch.id}:`, e?.message);
        }
      }
    } catch (err) {
      console.error("status updater error:", err);
    }
  },
};
