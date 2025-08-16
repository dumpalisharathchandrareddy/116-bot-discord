// commands/start_giveaway.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const giveawayHandler = require("../events/giveawayHandler.js");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("start_giveaway")
    .setDescription("Start the daily giveaway (Staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    // Staff role check
    const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID);
    if (!isStaff) {
      return interaction.reply({
        content: "❌ Only Staff can start the giveaway.",
        ephemeral: true,
      });
    }

    try {
      // 1) Announce FIRST in the same channel
      await interaction.channel.send({
        content: "@everyone 🎉 **New Giveaway Started!**\nJoin in now!",
        allowedMentions: { parse: ["everyone"] },
      });

      // 2) Then post the giveaway template via your handler
      await giveawayHandler.startGiveaway(interaction);

      // 3) Quiet confirmation back to the staffer
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: "✅ Announcement sent and giveaway posted.", ephemeral: true });
      } else {
        await interaction.reply({ content: "✅ Announcement sent and giveaway posted.", ephemeral: true });
      }
    } catch (err) {
      console.error("start_giveaway error:", err);
      const msg = "❌ Failed to start the giveaway.";
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ content: msg, ephemeral: true });
      }
      return interaction.reply({ content: msg, ephemeral: true });
    }
  },
};
