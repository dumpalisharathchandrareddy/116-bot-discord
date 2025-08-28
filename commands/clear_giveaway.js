const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const giveawayHandler = require("../events/giveawayHandler.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear_giveaway")
    .setDescription("Clear all giveaway data and prepare for a new one (Staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });   // <- reserve the reply

      // Ensure this function does NOT reply; remove interaction usage inside it
      await giveawayHandler.clearGiveaway();                // <- no interaction arg

      await interaction.editReply(
        "🔁 Giveaway has been reset.\nYou can now use `/start_giveaway` to begin a new one."
      );
    } catch (err) {
      // Safe error path even if reply already sent
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply("❌ Failed to clear the giveaway. Check logs.");
      } else {
        await interaction.followUp({ content: "❌ Failed to clear the giveaway. Check logs.", ephemeral: true }).catch(() => {});
      }
      console.error("Error executing /clear_giveaway:", err);
    }
  },
};
