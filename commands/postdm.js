const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("postdm")
    .setDescription("Post the DM button in this channel (Owner only)")
    .addStringOption(opt =>
      opt.setName("label")
        .setDescription("Text on the button (default: DM me the info)")
        .setRequired(false)
    ),

  async execute(interaction) {
    // ✅ Owner permission check
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({
        content: "❌ Only the **server owner** can use this command.",
        ephemeral: true,
      });
    }

    const label = interaction.options.getString("label") || "📩 DM me the info";

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`dm_request_${interaction.channel.id}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
      content: "✅ Button posted below.",
      ephemeral: true,
    });

    await interaction.channel.send({
      content: "**Click below to receive this channel's info in your DMs**",
      components: [row],
    });
  },
};
