const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sendembed")
    .setDescription("Send a custom embed to any channel (Staff/Owner only)")
    .addStringOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel ID or mention (e.g. #announcements or 123456789012345678)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("embedjson")
        .setDescription("Embed JSON code or plain text for description")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("image")
        .setDescription("Optional image URL to display in the embed")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("thumbnail")
        .setDescription("Optional thumbnail URL to display in the embed")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const member = interaction.member;
      const isStaff = member.roles.cache.has(STAFF_ROLE_ID);
      const isOwner = member.roles.cache.has(OWNER_ROLE_ID);

      if (!(isStaff || isOwner)) {
        return interaction.reply({
          content: "❌ You don’t have permission to use this command.",
          ephemeral: true,
        });
      }

      const channelInput = interaction.options.getString("channel");
      const embedInput = interaction.options.getString("embedjson");
      const imageUrl = interaction.options.getString("image");
      const thumbUrl = interaction.options.getString("thumbnail");

      // Clean channel mention or ID
      const channelId = channelInput.replace(/[<#>]/g, "");
      const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        return interaction.reply({
          content: "❌ Invalid channel ID or channel not found.",
          ephemeral: true,
        });
      }

      // Parse or build embed
      let embed;
      try {
        const data = JSON.parse(embedInput);
        embed = new EmbedBuilder(data);
      } catch {
        embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setDescription(embedInput)
          .setFooter({ text: `Sent by ${interaction.user.tag}` })
          .setTimestamp();
      }

      // Optional visuals
      if (imageUrl) embed.setImage(imageUrl);
      if (thumbUrl) embed.setThumbnail(thumbUrl);

      // Send embed
      await channel.send({ embeds: [embed] });

      await interaction.reply({
        content: `✅ Embed sent successfully to <#${channel.id}>.`,
        ephemeral: true,
      });
    } catch (err) {
      console.error("sendembed error:", err);
      await interaction.reply({
        content: "❌ Failed to send embed — check JSON format, image links, or permissions.",
        ephemeral: true,
      });
    }
  },
};
