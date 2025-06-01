const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const pointsFile = "./points.json";

const medals = ["🥇", "🥈", "🥉"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the top 10 users by points"),
  async execute(interaction) {
    const points = JSON.parse(fs.readFileSync(pointsFile, "utf-8"));
    const sorted = Object.entries(points)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    if (sorted.length === 0) {
      return interaction.reply("No leaderboard data available.");
    }

    const userFetches = await Promise.all(
      sorted.map(([userId]) =>
        interaction.client.users.fetch(userId).catch(() => null),
      ),
    );

    let leaderboardText = "";
    sorted.forEach(([userId, pts], index) => {
      const rank = medals[index] || `#${index + 1}`;
      const mention = `<@${userId}>`;
      leaderboardText += `${rank}  ${mention}  —  **${pts} pts**\n`;
    });

    // Top user's avatar as thumbnail
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
  },
};
