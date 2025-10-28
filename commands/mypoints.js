const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const pool = require("../db");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mypoints")
    .setDescription("View your points, or another user's points (staff/owner)")
    .setDefaultMemberPermissions(null)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to check points for (staff/owner only)")
        .setRequired(false)
    ),

  async execute(interaction) {
    await handlePoints(interaction, {
      targetUser: interaction.options.getUser("user"),
      isSlash: true,
    });
  },

  // 👇 Add a listener helper for message commands like !points
  async onMessage(message) {
    if (message.author.bot) return;
    if (!message.content.toLowerCase().startsWith("!points")) return;

    await handlePoints(message, { isSlash: false });
  },
};

// ─────────────────────────────────────────────
// 🔧 Shared logic between slash & message commands
// ─────────────────────────────────────────────
async function handlePoints(ctx, { targetUser = null, isSlash }) {
  try {
    const member = isSlash ? ctx.member : ctx.member ?? await ctx.guild.members.fetch(ctx.author.id);
    const isStaff = member.roles.cache.has(STAFF_ROLE_ID);
    const isOwner = member.roles.cache.has(OWNER_ROLE_ID);

    const user = targetUser || (isSlash ? ctx.user : ctx.author);

    if (targetUser && !(isStaff || isOwner)) {
      const reply = { content: "❌ Only Staff or Owner can view other users' points.", ephemeral: true };
      return isSlash ? ctx.reply(reply) : message.reply("❌ Only Staff or Owner can view other users' points.");
    }

    const result = await pool.query("SELECT points FROM points WHERE user_id = $1", [user.id]);
    const userPoints = result.rows[0]?.points || 0;

    const embed = new EmbedBuilder()
      .setTitle("⭐ Points Balance")
      .setDescription(`<@${user.id}> has **${userPoints}** point${userPoints !== 1 ? "s" : ""}.`)
      .setColor(0xf1c40f)
      .setTimestamp()
      .setFooter({
        text: `Requested by ${isSlash ? ctx.user.tag : ctx.author.tag}`,
      });

    if (isSlash) {
      await ctx.reply({ embeds: [embed], ephemeral: true });
    } else {
      await ctx.reply({ embeds: [embed] });
    }
  } catch (err) {
    console.error("points command error:", err);
    const msg = "❌ Failed to retrieve points.";
    if (isSlash) await ctx.reply({ content: msg, ephemeral: true });
    else await ctx.reply(msg);
  }
}
