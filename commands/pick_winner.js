const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const pool = require("../db");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1369794789553475704";
const MIN_ENTRIES = 20;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pick_winner")
    .setDescription("🎁 Pick (or repick) a giveaway winner (Staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID);
    if (!isStaff) {
      return interaction.reply({
        content: "❌ Only Staff can pick the giveaway winner.",
        ephemeral: true,
      });
    }

    try {
      const result = await pool.query("SELECT user_id FROM giveaway_entries");
      const entries = result.rows.map(row => row.user_id);

      if (entries.length < MIN_ENTRIES) {
        return interaction.reply({
          content: `❌ Not enough entries! ${MIN_ENTRIES} required. Currently: ${entries.length}.`,
          ephemeral: true,
        });
      }

      const winnerId = entries[Math.floor(Math.random() * entries.length)];

      return interaction.reply(
        `🎉 **Congratulations <@${winnerId}>!** You won today's giveaway! 🎁\n` +
        `👉 Your next order will be **NO SERVICE FEE** (Uber fees & food still paid)\n\n` +
        `> You can repick a new winner anytime using this command again.`
      );
    } catch (error) {
      console.error("pickWinner error:", error);
      return interaction.reply({
        content: "❌ Failed to pick a winner due to a database error.",
        ephemeral: true,
      });
    }
  },
};
