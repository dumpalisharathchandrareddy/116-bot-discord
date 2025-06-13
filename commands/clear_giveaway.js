const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const giveawayHandler = require("../events/giveawayHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear_giveaway")
    .setDescription("Clear all giveaway data and prepare for a new one (Staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await giveawayHandler.clearGiveaway(interaction);

    // Optional: public confirmation log
    const channel = interaction.channel;
    await channel.send(
      `🔁 Giveaway has been reset by <@${interaction.user.id}>.\nYou can now use \`/start_giveaway\` to begin a new one.`
    );
  },
};
