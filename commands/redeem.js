const { SlashCommandBuilder } = require("discord.js");
const pool = require("../db");

const rewardLabels = {
  40: "Completely Free Order (Up to $25)",
  15: "No Fee Order (Waives $5 order fee)",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("redeem")
    .setDescription("Staff-only: Redeem a known reward for a user by entering point value")
    .addUserOption((option) =>
      option.setName("user").setDescription("User redeeming the reward").setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName("points").setDescription("Points to deduct (e.g., 15 or 40)").setRequired(true)
    ),

  async execute(interaction) {
    try {
      const staff = await interaction.guild.members.fetch(interaction.user.id);
      const isStaff = staff.roles.cache.has(process.env.STAFF_ROLE_ID);

      if (!isStaff) {
        return interaction.reply({
          content: "❌ You do not have permission to use this command.",
          ephemeral: true,
        });
      }

      const user = interaction.options.getUser("user");
      const pointsToDeduct = interaction.options.getInteger("points");

      const rewardName =
        rewardLabels[pointsToDeduct] || `a custom reward worth ${pointsToDeduct} points`;

      const userResult = await pool.query("SELECT points FROM points WHERE user_id = $1", [user.id]);
      const userPoints = userResult.rows[0]?.points || 0;

      if (userPoints < pointsToDeduct) {
        return interaction.reply({
          content: `❌ <@${user.id}> only has **${userPoints}** points — not enough for this reward.`,
          allowedMentions: { users: [user.id] },
          ephemeral: true,
        });
      }

      await pool.query("UPDATE points SET points = points - $1 WHERE user_id = $2", [pointsToDeduct, user.id]);
      const updated = await pool.query("SELECT points FROM points WHERE user_id = $1", [user.id]);
      const remaining = updated.rows[0]?.points || 0;

      await interaction.reply({
        content: `✅ <@${user.id}> redeemed **${pointsToDeduct}** points for **${rewardName}**.\nRemaining: **${remaining}** points.`,
        allowedMentions: { users: [user.id] },
      });
    } catch (error) {
      console.error("redeem error:", error);
      await interaction.reply({
        content: "❌ An error occurred while processing the reward redemption.",
        ephemeral: true,
      });
    }
  },
};
