const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const pool = require("../db");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1400611714650607646";
const OWNER_ID = "1400611712104927232";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("removepoints")
    .setDescription("Remove points from a user (Staff/Admin/Owner)")
    .addUserOption((option) =>
      option.setName("user").setDescription("User to remove points from").setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName("amount").setDescription("Number of points to remove").setRequired(true)
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

    const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!targetMember) {
      return interaction.reply({
        content: "❌ Cannot remove points — user is not in this server.",
        ephemeral: true,
      });
    }

    try {
      const { rows } = await pool.query("SELECT points FROM points WHERE user_id = $1", [user.id]);
      const currentPoints = rows[0]?.points || 0;
      const newPoints = Math.max(currentPoints - amount, 0);

      await pool.query(
        "INSERT INTO points (user_id, points) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET points = EXCLUDED.points",
        [user.id, newPoints]
      );

      const embed = new EmbedBuilder()
        .setTitle("Points Removed!")
        .setDescription(
          `❌ <@${user.id}> lost **${amount} point${amount !== 1 ? "s" : ""}**.\nNew total: **${newPoints}**`
        )
        .setColor(0xe74c3c)
        .setTimestamp()
        .setFooter({ text: `Removed by ${interaction.user.tag}` });

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("removepoints.js error:", err);
      await interaction.reply({
        content: "❌ Failed to remove points due to a database error.",
        ephemeral: true,
      });
    }
  },
};
