const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const pointsFile = path.join(__dirname, "../points.json");
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1369794789553475704";
const OWNER_ID = "666746569193816086";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("removepoints")
    .setDescription("Remove points from a user (Staff/Admin/Owner)")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to remove points from")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of points to remove")
        .setRequired(true),
    ),
  async execute(interaction) {
    const member = interaction.member;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = member.roles.cache.has(STAFF_ROLE_ID);
    const isOwner = interaction.user.id === OWNER_ID;

    if (!(isAdmin || isStaff || isOwner)) {
      return interaction.reply({
        content: "❌ Only Staff, Admins or Owner can remove points.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    if (amount <= 0) {
      return interaction.reply({
        content: "❌ Please enter a positive number of points to remove.",
        ephemeral: true,
      });
    }

    const targetMember = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!targetMember) {
      return interaction.reply({
        content: "❌ Cannot remove points — user is not in this server.",
        ephemeral: true,
      });
    }

    let points = {};
    try {
      points = JSON.parse(fs.readFileSync(pointsFile, "utf-8"));
    } catch {
      points = {};
    }

    points[user.id] = Math.max((points[user.id] || 0) - amount, 0);

    fs.writeFileSync(pointsFile, JSON.stringify(points, null, 2));

    const embed = new EmbedBuilder()
      .setTitle("Points Removed!")
      .setDescription(
        `❌ <@${user.id}> lost **${amount} point${amount !== 1 ? "s" : ""}**.\nNew total: **${points[user.id]}**`,
      )
      .setColor(0xe74c3c)
      .setTimestamp()
      .setFooter({ text: `Removed by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  },
};
