const { Events, EmbedBuilder } = require("discord.js");

module.exports = (client) => {
  const TICKET_CATEGORY_ID = "1380405550583517295"; // updated to open ticket category
  const OWNER_ID = "666746569193816086";
  const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID; // ensure set in .env

  client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.name.startsWith("ticket-")) return;
    if (!channel.guild || channel.parentId !== TICKET_CATEGORY_ID) return;

    setTimeout(async () => {
      const openTickets = channel.guild.channels.cache.filter(
        (c) =>
          c.parentId === TICKET_CATEGORY_ID && c.name.startsWith("ticket-")
      );

      const sortedTicketsArray = openTickets
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .toJSON();

      const position =
        sortedTicketsArray.findIndex((c) => c.id === channel.id) + 1;
      const estimatedWait = position * 4; // minutes

      const embed = new EmbedBuilder()
        .setTitle("🎟️ Ticket Queue Info")
        .setDescription(
          `⏳ You are **#${position}** in line.\n` +
            `**Estimated wait:** \`${estimatedWait} minutes\`\n\n` +
            `Please be patient, our staff will assist you as soon as possible!\n\n` +
            `> If you have urgent info, please add it here!`
        )
        .setColor(0x5865f2)
        .setFooter({ text: "Thank you for ordering from 116's UE!" })
        .setTimestamp();

      await channel.send({
        content: `<@${OWNER_ID}> <@&${STAFF_ROLE_ID}>`,
        embeds: [embed],
      });

      await channel.send(
        "📦 **Please send your cart link here in the chat and also mention your city!** 🏙️"
      );
    }, 5000); // wait for permissions to be ready
  });
};
