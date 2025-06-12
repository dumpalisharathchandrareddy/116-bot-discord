const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const giveawayHandler = require("../events/giveawayHandler.js");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1369794789553475704";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("start_giveaway")
    .setDescription("Start the daily giveaway (Staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID);

    if (!isStaff) {
      return interaction.reply({
        content: "❌ Only Staff can start the giveaway.",
        ephemeral: true,
      });
    }

    await giveawayHandler.startGiveaway(interaction);
  },
};
