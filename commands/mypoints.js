const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const pool = require("../db");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1400611714650607646";
const OWNER_ID = "1400611712104927232";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mypoints")
    .setDescription("View your points, or another user's points (staff/owner)")
    .setDefaultMemberPermissions(null)   // 👈 forces visibility to everyone
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to check points for (staff/owner only)")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
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

      const result = await pool.query("SELECT points FROM points WHERE user_id = $1", [targetUser.id]);
      const userPoints = result.rows[0]?.points || 0;

      const embed = new EmbedBuilder()
        .setTitle("Points Balance")
        .setDescription(
          `⭐ <@${targetUser.id}> has **${userPoints}** point${userPoints !== 1 ? "s" : ""}.`
        )
        .setColor(0xf1c40f)
        .setTimestamp()
        .setFooter({ text: `Requested by ${interaction.user.tag}` });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error("mypoints error:", error);
      await interaction.reply({
        content: "❌ Failed to retrieve points.",
        ephemeral: true,
      });
    }
  },
};
