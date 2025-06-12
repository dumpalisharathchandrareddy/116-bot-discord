const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const pool = require("../db");

const medals = ["🥇", "🥈", "🥉"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the top 10 users by points"),
  async execute(interaction) {
    try {
      const result = await pool.query(
        "SELECT user_id, points FROM points ORDER BY points DESC LIMIT 10"
      );
      const sorted = result.rows;

      if (sorted.length === 0) {
        return interaction.reply("No leaderboard data available.");
      }

      const userFetches = await Promise.all(
        sorted.map((row) =>
          interaction.client.users.fetch(row.user_id).catch(() => null)
        )
      );

      let leaderboardText = "";
      sorted.forEach((row, index) => {
        const rank = medals[index] || `#${index + 1}`;
        const mention = `<@${row.user_id}>`;
        leaderboardText += `${rank}  ${mention}  —  **${row.points} pts**\n`;
      });

      const topUser = userFetches[0];
      const avatarUrl =
        topUser?.displayAvatarURL({ size: 256 }) ||
        interaction.client.user.displayAvatarURL({ size: 256 });

      const embed = new EmbedBuilder()
        .setTitle("🏆 Points Leaderboard")
        .setDescription(leaderboardText)
        .setColor(0xffd700)
        .setThumbnail(avatarUrl)
        .setFooter({ text: "Top 10 users by points | 116 bot" });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Leaderboard error:", error);
      await interaction.reply({
        content: "❌ Failed to load leaderboard.",
        ephemeral: true,
      });
    }
  },
};
