const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const pool = require("../db");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1400611714650607646";
const OWNER_ID = "1400611712104927232";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("resetpoints")
    .setDescription("Reset a user's points to 0 (Staff/Admin/Owner)")
    .addUserOption((option) =>
      option.setName("user").setDescription("User to reset points for").setRequired(true)
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

    try {
      await pool.query(
        "INSERT INTO points (user_id, points) VALUES ($1, 0) ON CONFLICT (user_id) DO UPDATE SET points = 0",
        [user.id]
      );

      const embed = new EmbedBuilder()
        .setTitle("Points Reset!")
        .setDescription(`🧹 <@${user.id}>'s points have been reset to **0**.`)
        .setColor(0x3498db)
        .setTimestamp()
        .setFooter({ text: `Reset by ${interaction.user.tag}` });

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("resetpoints.js error:", err);
      await interaction.reply({
        content: "❌ Failed to reset points due to a database error.",
        ephemeral: true,
      });
    }
  },
};
