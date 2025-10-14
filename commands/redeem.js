// commands/redeem.js
const { SlashCommandBuilder } = require("discord.js");
const pool = require("../db");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

// Canonical reward labels
const REWARD_LABELS = {
  7:  "5-in-5 Streak (5 orders in 5 days)",
  15: "Fee-Free Order (waives $8 service fee)",
  40: "Complete Free Order",
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
        .setName("points")
        .setDescription("Choose a reward")
        .setRequired(true)
        .addChoices(
          { name: "7 pts — 5-in-5 Streak", value: 7 },
          { name: "15 pts — Fee-Free Order", value: 15 },
          { name: "40 pts — Complete Free Order", value: 40 },
        )
    ),

  async execute(interaction) {
    try {
      // Staff check
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isStaff = STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID);
      if (!isStaff) {
        return interaction.reply({
          content: "❌ You do not have permission to use this command.",
          ephemeral: true,
        });
      }

      const user = interaction.options.getUser("user", true);
      const pointsToDeduct = interaction.options.getInteger("points", true);

      // Defensive: ensure it's one of our supported tiers
      if (!(pointsToDeduct in REWARD_LABELS)) {
        return interaction.reply({
          content: "❌ Invalid reward tier. Use 7, 15, or 40.",
          ephemeral: true,
        });
      }

      const rewardName = REWARD_LABELS[pointsToDeduct];

      // Fetch current points
      const userResult = await pool.query(
        "SELECT points FROM points WHERE user_id = $1",
        [user.id]
      );
      const userPoints = Number(userResult.rows[0]?.points || 0);

      if (userPoints < pointsToDeduct) {
        return interaction.reply({
          content: `❌ <@${user.id}> has **${userPoints}** points — not enough for **${pointsToDeduct}**.`,
          allowedMentions: { users: [user.id] },
          ephemeral: true,
        });
      }

      // Deduct and confirm
      await pool.query(
        "UPDATE points SET points = points - $1 WHERE user_id = $2",
        [pointsToDeduct, user.id]
      );

      const updated = await pool.query(
        "SELECT points FROM points WHERE user_id = $1",
        [user.id]
      );
      const remaining = Number(updated.rows[0]?.points || 0);

      // Public confirmation (mention the user)
      await interaction.reply({
        content:
          `✅ <@${user.id}> redeemed **${pointsToDeduct}** points for **${rewardName}**.\n` +
          `Remaining balance: **${remaining}** point(s).`,
        allowedMentions: { users: [user.id] },
      });
    } catch (error) {
      console.error("redeem error:", error);
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({
          content: "❌ An error occurred while processing the reward redemption.",
          ephemeral: true,
        });
      }
      return interaction.reply({
        content: "❌ An error occurred while processing the reward redemption.",
        ephemeral: true,
      });
    }
  },
};
