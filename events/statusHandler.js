const { EmbedBuilder, Events } = require("discord.js");

const STATUS_CHANNEL_ID = "1380321009877520455";
const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const OWNER_ID = "666746569193816086";

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    if (message.author.bot) return;

    const userId = message.author.id;
    const lowerContent = message.content.toLowerCase();
    const isMentioningBot = message.mentions.has(client.user);

    if (!isMentioningBot) return;
    if (!["open", "busy", "closed"].some((w) => lowerContent.includes(w)))
      return;
    if (message.guild.id !== GUILD_ID) return;

    const member = await message.guild.members.fetch(userId).catch(() => null);
    const isStaff = member?.roles.cache.has(STAFF_ROLE_ID);
    if (!isStaff) return;

    const statusChannel = await message.guild.channels
      .fetch(STATUS_CHANNEL_ID)
      .catch(() => null);
    if (!statusChannel || !statusChannel.manageable) return;

    let newName = "";
    let statusEmbed = null;

    if (lowerContent.includes("open")) {
      newName = "🟢**Open**🟢・status";
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

🛒 Place your group order now!`,
        )
        .setImage("https://media.giphy.com/media/BuixK83naJThKrTDXF/giphy.gif")
        .setColor(0x00ff66)
        .setFooter({ text: "Updated by Info Bot • OPEN for orders" })
        .setTimestamp();
    } else if (lowerContent.includes("busy")) {
      newName = "🟠**Busy**🟠・status";
      statusEmbed = new EmbedBuilder()
        .setTitle("🟠 STATUS: BUSY")
        .setDescription(
          `**⚠️ CURRENTLY PROCESSING ORDERS**
_May be a slight delay_

**💬 PLEASE BE PATIENT**  
Avoid spam, we will respond ASAP

❤️ Thank you for your support!`,
        )
        .setImage("https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif")
        .setColor(0xffa500)
        .setFooter({ text: "Updated by Info Bot • Currently Busy" })
        .setTimestamp();
    } else if (lowerContent.includes("closed")) {
      newName = "🔴**Closed**🔴・status";
      statusEmbed = new EmbedBuilder()
        .setTitle("🔴 STATUS: CLOSED")
        .setDescription(
          `**❌ CURRENTLY CLOSED**
No orders are being accepted.

**🕐 CHECK BACK LATER**  
🔔 Stay notified for updates!

🙏 Thanks for your patience.`,
        )
        .setImage("https://media.tenor.com/znjmPw_FF3sAAAAC/close.gif")
        .setColor(0xff0000)
        .setFooter({ text: "Updated by 1 1 6  M A S T E R • Currently Closed" })
        .setTimestamp();
    }

    if (newName && statusEmbed) {
      if (statusChannel.name !== newName) {
        await statusChannel.setName(newName).catch(console.error);
      }

      const messages = await statusChannel.messages.fetch({ limit: 50 });
      const deletableMessages = messages.filter(
        (m) =>
          m.author.id === client.user.id || m.author.id === message.author.id,
      );
      for (const msg of deletableMessages.values()) {
        await msg.delete().catch(() => {});
      }

      // Line 109 safe version:
      try {
        await message.react("✅");
      } catch (err) {
        console.warn("⚠️ Could not react — message may have been deleted.");
      }

      await statusChannel
        .send({ content: "@everyone", embeds: [statusEmbed] })
        .catch(console.error);
    }
  },
};
