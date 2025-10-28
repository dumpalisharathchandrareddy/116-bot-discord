const { SlashCommandBuilder } = require("discord.js");
const pool = require("../db");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

// ✅ Updated Reward Labels
const REWARD_LABELS = {
  5:  "50% Off Fee (5 points)",
  10: "100% Off Fee (10 points)",
  4:  "4-Day Streak — No Fee Order", // Streak reward (manual if needed)
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("redeem")
    .setDescription("Staff-only: Redeem a loyalty reward for a user")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User redeeming the reward")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("reward")
        .setDescription("Select the reward to redeem")
        .setRequired(true)
        .addChoices(
          { name: "5 pts — 50% Off Fee", value: 5 },
          { name: "10 pts — 100% Off Fee", value: 10 },
          { name: "4-Day Streak — No Fee Order", value: 4 },
        )
    ),

  async execute(interaction) {
    try {
      // Staff permission check
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isStaff = STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID);
      if (!isStaff) {
        return interaction.reply({
          content: "❌ You do not have permission to use this command.",
          ephemeral: true,
        });
      }

      const user = interaction.options.getUser("user", true);
      const rewardValue = interaction.options.getInteger("reward", true);

      // Defensive check
      if (!(rewardValue in REWARD_LABELS)) {
        return interaction.reply({
          content: "❌ Invalid reward tier. Use 4, 5, or 10.",
          ephemeral: true,
        });
      }

      const rewardName = REWARD_LABELS[rewardValue];

      // For 4-Day Streak, skip point deduction (manual streak)
      if (rewardValue === 4) {
        return interaction.reply({
          content: `✅ <@${user.id}> has earned the **${rewardName}** reward! 🎉`,
          allowedMentions: { users: [user.id] },
        });
      }

      // Fetch user points
      const res = await pool.query("SELECT points FROM points WHERE user_id = $1", [user.id]);
      const currentPoints = Number(res.rows[0]?.points || 0);

      if (currentPoints < rewardValue) {
        return interaction.reply({
          content: `❌ <@${user.id}> has **${currentPoints}** points — not enough for **${rewardValue}**.`,
          allowedMentions: { users: [user.id] },
          ephemeral: true,
        });
      }

      // Deduct points
      await pool.query("UPDATE points SET points = points - $1 WHERE user_id = $2", [
        rewardValue,
        user.id,
      ]);

      const updated = await pool.query("SELECT points FROM points WHERE user_id = $1", [user.id]);
      const remaining = Number(updated.rows[0]?.points || 0);

      // Confirmation
      await interaction.reply({
        content:
          `✅ <@${user.id}> redeemed **${rewardValue}** points for **${rewardName}**.\n` +
          `Remaining balance: **${remaining}** point(s).`,
        allowedMentions: { users: [user.id] },
      });
    } catch (error) {
      console.error("redeem error:", error);
      const msg = "❌ An error occurred while processing the reward redemption.";
      if (interaction.deferred || interaction.replied)
        return interaction.followUp({ content: msg, ephemeral: true });
      return interaction.reply({ content: msg, ephemeral: true });
    }
  },
};
