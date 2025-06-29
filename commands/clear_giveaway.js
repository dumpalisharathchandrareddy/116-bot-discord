const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const giveawayHandler = require("../events/giveawayHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear_giveaway")
    .setDescription("Clear all giveaway data and prepare for a new one (Staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    // reset giveaway data
    await giveawayHandler.clearGiveaway(interaction);

    // send an ephemeral confirmation to the staff member who triggered the command
    await interaction.reply({
      content: `🔁 Giveaway has been reset.\nYou can now use \`/start_giveaway\` to begin a new one.`,
      ephemeral: true,          // <-- only visible to the executor
    });
  },
};
