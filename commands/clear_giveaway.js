const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const giveawayHandler = require("../events/giveawayHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear_giveaway")
    .setDescription("Clear giveaway state (Staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, client) {
    await giveawayHandler.clearGiveaway(interaction);
  },
};
