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
    .setName("resetpoints")
    .setDescription("Reset a user's points to 0 (Staff/Admin/Owner)")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to reset points for")
        .setRequired(true),
    ),
  async execute(interaction) {
    const member = interaction.member;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = member.roles.cache.has(STAFF_ROLE_ID);
    const isOwner = interaction.user.id === OWNER_ID;

    if (!(isAdmin || isStaff || isOwner)) {
      return interaction.reply({
        content: "❌ Only Staff, Admins or Owner can reset points.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("user");

    let points = {};
    try {
      points = JSON.parse(fs.readFileSync(pointsFile, "utf-8"));
    } catch {
      points = {};
    }

    points[user.id] = 0;

    fs.writeFileSync(pointsFile, JSON.stringify(points, null, 2));

    const embed = new EmbedBuilder()
      .setTitle("Points Reset!")
      .setDescription(`🧹 <@${user.id}>'s points have been reset to **0**.`)
      .setColor(0x3498db)
      .setTimestamp()
      .setFooter({ text: `Reset by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
  },
};
