const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const giveawayHandler = require("../events/giveawayHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("start_giveaway")
    .setDescription("Start the daily giveaway (Staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, client) {
    await giveawayHandler.startGiveaway(interaction);
  },
};
