const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const pool = require("../db");

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

    try {
      const existing = await pool.query("SELECT points FROM points WHERE user_id = $1", [user.id]);

      if (existing.rowCount === 0) {
        await pool.query("INSERT INTO points (user_id, points) VALUES ($1, $2)", [user.id, amount]);
      } else {
        await pool.query("UPDATE points SET points = points + $1 WHERE user_id = $2", [amount, user.id]);
      }

      const result = await pool.query("SELECT points FROM points WHERE user_id = $1", [user.id]);
      const totalPoints = result.rows[0].points;

      const embed = new EmbedBuilder()
        .setTitle("Points Given!")
        .setDescription(
          `✅ <@${user.id}> received **${amount} point${amount !== 1 ? "s" : ""}**.\nNew total: **${totalPoints}**`,
        )
        .setColor(0x2ecc71)
        .setTimestamp()
        .setFooter({ text: `Given by ${interaction.user.tag}` });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("givepoints error:", error);
      await interaction.reply({
        content: "❌ An error occurred while giving points.",
        ephemeral: true,
      });
    }
  },
};
