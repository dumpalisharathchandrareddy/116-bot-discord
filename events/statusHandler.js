const { EmbedBuilder, Events, PermissionFlagsBits, ChannelType } = require("discord.js");

// Rename BOTH (second is voice: rename-only)
const STATUS_RENAME_CHANNEL_IDS = [
  "1400619386964017314", // main text channel (rename + post/cleanup)
  "1400623787816521949", // voice channel (rename only)
];

// Post/Cleanup ONLY in these (must be text-like)
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

      // must mention the bot
      const isMentioningBot =
        message.mentions.users.has(client.user.id) ||
        message.content.includes(`<@${client.user.id}>`) ||
        message.content.includes(`<@!${client.user.id}>`);
      if (!isMentioningBot) return;

      // must include keyword
      const lower = message.content.toLowerCase();
      const keyword = ["open", "busy", "closed"].find(w => lower.includes(w));
      if (!keyword) return;

      // staff only
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      const isStaff = STAFF_ROLE_ID ? member?.roles.cache.has(STAFF_ROLE_ID) : false;
      if (!isStaff) return;

      // build name + embed
      let newName = "";
      let statusEmbed = null;

      if (keyword === "open") {
        newName = "🟢open🟢・status";
        statusEmbed = new EmbedBuilder()
          .setTitle("🟢 STATUS: NOW OPEN")
          .setDescription(
            "✅ **We are currently taking orders!**\n\n" +
            "📣 Expect a queue — respond to pings ASAP\n" +
            "🛒 Place your group order now!"
          )
          .setColor(0x00ff66)
          .setTimestamp();
      } else if (keyword === "busy") {
        newName = "🟠busy🟠・status";
        statusEmbed = new EmbedBuilder()
          .setTitle("🟠 STATUS: BUSY")
          .setDescription("**⚠️ Processing orders** — there may be a slight delay.")
          .setColor(0xffa500)
          .setTimestamp();
      } else {
        newName = "🔴closed🔴・status";
        statusEmbed = new EmbedBuilder()
          .setTitle("🔴 STATUS: CLOSED")
          .setDescription("No orders are being accepted right now. Please check back later.")
          .setColor(0xff0000)
          .setTimestamp();
      }

      // choose ping
      const mentionTag = keyword === "open" ? "@everyone" : "@here";

      // react (best effort)
      try { await message.react("✅"); } catch {}

      const me = await message.guild.members.fetchMe();

      for (const id of STATUS_RENAME_CHANNEL_IDS) {
        const ch = await message.guild.channels.fetch(id).catch(() => null);
        if (!ch) continue;

        const isTextLike =
          ch.type === ChannelType.GuildText ||
          ch.type === ChannelType.GuildAnnouncement;
        const isVoice = ch.type === ChannelType.GuildVoice;

        // rename for both text and voice (if allowed)
        if (ch.manageable && ch.name !== newName) {
          try { await ch.setName(newName); }
          catch (e) { console.warn(`⚠️ setName failed for #${ch.id}:`, e?.message); }
        }

        // only post/cleanup in configured posting channels AND only if text-like
        if (!STATUS_POST_CHANNEL_IDS.includes(id)) continue;
        if (!isTextLike) continue; // voice can't receive messages

        const perms = ch.permissionsFor(me);
        const canSend =
          perms?.has(PermissionFlagsBits.ViewChannel) &&
          perms?.has(PermissionFlagsBits.SendMessages);

        if (!canSend) continue;

        // cleanup (last 50) only in posting channel
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

        // send embed with correct ping
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
