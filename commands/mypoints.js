const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const pointsFile = path.join(__dirname, "../points.json");
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1369794789553475704";
const OWNER_ID = "666746569193816086";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mypoints")
    .setDescription("View your points, or another user's points (staff/owner)")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to check points for (staff/owner only)")
        .setRequired(false),
    ),
  async execute(interaction) {
    const member = interaction.member;
    const isStaff = member.roles.cache.has(STAFF_ROLE_ID);
    const isOwner = interaction.user.id === OWNER_ID;

    const targetUser = interaction.options.getUser("user") || interaction.user;

    if (interaction.options.getUser("user") && !(isStaff || isOwner)) {
      return interaction.reply({
        content: "❌ Only Staff or Owner can view other users' points.",
        ephemeral: true,
      });
    }

    let points = {};
    try {
      points = JSON.parse(fs.readFileSync(pointsFile, "utf-8"));
    } catch {
      points = {};
    }

    const userPoints = points[targetUser.id] || 0;

    const embed = new EmbedBuilder()
      .setTitle("Points Balance")
      .setDescription(
        `⭐ <@${targetUser.id}> has **${userPoints}** point${userPoints !== 1 ? "s" : ""}.`,
      )
      .setColor(0xf1c40f)
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
