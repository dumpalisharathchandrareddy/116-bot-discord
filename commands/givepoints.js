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
    .setName("givepoints")
    .setDescription("Give points to a user (Staff/Admin/Owner)")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to give points to")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of points to give")
        .setRequired(true),
    ),
  async execute(interaction) {
    const member = interaction.member;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = member.roles.cache.has(STAFF_ROLE_ID);
    const isOwner = interaction.user.id === OWNER_ID;

    if (!(isAdmin || isStaff || isOwner)) {
      return interaction.reply({
        content: "❌ Only Staff, Admins or Owner can give points.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    if (amount <= 0) {
      return interaction.reply({
        content: "❌ Please enter a positive number of points to give.",
        ephemeral: true,
      });
    }

    const targetMember = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!targetMember) {
      return interaction.reply({
        content: "❌ Cannot give points — user is not in this server.",
        ephemeral: true,
      });
    }

    const targetIsStaff = targetMember.roles.cache.has(STAFF_ROLE_ID);

    if (targetIsStaff && !isOwner) {
      return interaction.reply({
        content: "❌ You cannot give points to Staff members.",
        ephemeral: true,
      });
    }

    let points = {};
    try {
      points = JSON.parse(fs.readFileSync(pointsFile, "utf-8"));
    } catch {
      points = {};
    }

    points[user.id] = (points[user.id] || 0) + amount;

    fs.writeFileSync(pointsFile, JSON.stringify(points, null, 2));

    const embed = new EmbedBuilder()
      .setTitle("Points Given!")
      .setDescription(
        `✅ <@${user.id}> received **${amount} point${amount !== 1 ? "s" : ""}**.\nNew total: **${points[user.id]}**`,
      )
      .setColor(0x2ecc71)
      .setTimestamp()
      .setFooter({ text: `Given by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  },
};
