const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");

const rewardLabels = {
  30: "Completely Free Order (Up to $25)",
  15: "No Fee Order (Waives $5 order fee)",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("redeem")
    .setDescription(
      "Staff-only: Redeem a known reward for a user by entering point value",
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User redeeming the reward")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("points")
        .setDescription("Points to deduct (e.g., 15 or 30)")
        .setRequired(true),
    ),

  async execute(interaction, client) {
    const staff = await interaction.guild.members.fetch(interaction.user.id);
    const isStaff = staff.roles.cache.has(process.env.STAFF_ROLE_ID);

    if (!isStaff) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        flags: 64,
      });
    }

    const user = interaction.options.getUser("user");
    const pointsToDeduct = interaction.options.getInteger("points");

    const rewardName =
      rewardLabels[pointsToDeduct] ||
      `a custom reward worth ${pointsToDeduct} points`;

    client.points[user.id] = client.points[user.id] || 0;

    if (client.points[user.id] < pointsToDeduct) {
      return interaction.reply({
        content: `❌ <@${user.id}> only has **${client.points[user.id]}** points — not enough for this reward.`,
        allowedMentions: { users: [user.id] },
        flags: 64,
      });
    }

    client.points[user.id] -= pointsToDeduct;
    fs.writeFileSync("./points.json", JSON.stringify(client.points, null, 2));

    await interaction.reply({
      content: `✅ <@${user.id}> redeemed **${pointsToDeduct}** points for **${rewardName}**.\nRemaining: **${client.points[user.id]}** points.`,
      allowedMentions: { users: [user.id] },
    });
  },
};
