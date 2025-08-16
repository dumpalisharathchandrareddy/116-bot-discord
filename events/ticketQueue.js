const { Events, EmbedBuilder, ChannelType } = require("discord.js");

module.exports = (client) => {
  const TICKET_CATEGORY_ID = process.env.OPEN_TICKET_CATEGORY_ID; // Open tickets category
  const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID;      // <-- treat this as ROLE id
  const OWNER_USER_ID = process.env.OWNER_USER_ID ; // optional single owner user
  const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;  // required

  client.on(Events.ChannelCreate, async (channel) => {
    try {
      // only text channels in the target category named ticket-*
      if (!channel.guild) return;
      if (channel.type !== ChannelType.GuildText) return;
      if (channel.parentId !== TICKET_CATEGORY_ID) return;
      if (!channel.name?.startsWith?.("ticket-")) return;

      // small delay so perms/overwrites settle (common with ticket bots)
      await new Promise((r) => setTimeout(r, 5000));

      // compute queue position among ticket-* in this category
      const siblings = channel.guild.channels.cache.filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.parentId === TICKET_CATEGORY_ID &&
          c.name?.startsWith?.("ticket-")
      );

      const sorted = [...siblings.values()].sort(
        (a, b) => (a.createdTimestamp || 0) - (b.createdTimestamp || 0)
      );

      const position = Math.max(1, sorted.findIndex((c) => c.id === channel.id) + 1);
      const estimatedWait = position * 7; // minutes

      const embed = new EmbedBuilder()
        .setTitle("🎟️ Ticket Queue Info")
        .setDescription(
          `⏳ You are **#${position}** in line.\n` +
          `**Estimated wait:** \`${estimatedWait} minutes\`\n\n` +
          `Please be patient — our staff will assist you as soon as possible!\n\n` +
          `> If you have urgent info, please add it here.`
        )
        .setColor(0x5865f2)
        .setFooter({ text: "Thank you for ordering from 116's UE!" })
        .setTimestamp();

      // Build mentions safely:
      // - Owner role (ping as role)
      // - Optional single owner user
      // - Staff role
      const mentionParts = [];
      if (OWNER_ROLE_ID) mentionParts.push(`<@&${OWNER_ROLE_ID}>`);
      if (OWNER_USER_ID) mentionParts.push(`<@${OWNER_USER_ID}>`);
      if (STAFF_ROLE_ID) mentionParts.push(`<@&${STAFF_ROLE_ID}>`);
      const mentionLine = mentionParts.join(" ");

      await channel.send({ content: mentionLine || null, embeds: [embed] });

      await channel.send(
        "📦 **Please send your cart link here in the chat and also mention your city!** 🏙️"
      );
    } catch (err) {
      console.error("ticket ChannelCreate handler error:", err);
    }
  });
};
