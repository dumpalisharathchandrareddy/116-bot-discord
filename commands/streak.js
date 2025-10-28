const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const pool = require("../db");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("streak")
    .setDescription("Check your order streak, or another user's streak (staff/owner only)")
    .setDefaultMemberPermissions(null)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to check streak for (staff/owner only)")
        .setRequired(false)
    ),

  async execute(interaction) {
    await handleStreak(interaction, {
      targetUser: interaction.options.getUser("user"),
      isSlash: true,
    });
  },

  // 👇 Text command support (!streak)
  async onMessage(message) {
    if (message.author.bot) return;
    if (!message.content.toLowerCase().startsWith("!streak")) return;

    const mention = message.mentions.users.first() || null;
    await handleStreak(message, {
      targetUser: mention,
      isSlash: false,
    });
  },
};

// ─────────────────────────────────────────────
// 🔧 Shared logic for slash and message commands
// ─────────────────────────────────────────────
async function handleStreak(ctx, { targetUser = null, isSlash }) {
  try {
    const member = isSlash
      ? ctx.member
      : ctx.member ?? (await ctx.guild.members.fetch(ctx.author.id));
    const isStaff = member.roles.cache.has(STAFF_ROLE_ID);
    const isOwner = member.roles.cache.has(OWNER_ROLE_ID);

    const user = targetUser || (isSlash ? ctx.user : ctx.author);

    // Restrict viewing others' streaks
    if (targetUser && !(isStaff || isOwner)) {
      const msg = "❌ Only Staff or Owner can view other users' streaks.";
      return isSlash
        ? ctx.reply({ content: msg, ephemeral: true })
        : ctx.reply(msg);
    }

    // Fetch order dates
    const result = await pool.query(
      "SELECT order_date FROM orders WHERE user_id = $1 ORDER BY order_date DESC",
      [user.id]
    );

    if (result.rows.length === 0) {
      const msg = `📭 <@${user.id}> has no recorded orders.`;
      return isSlash
        ? ctx.reply({ content: msg, ephemeral: true, allowedMentions: { users: [user.id] } })
        : ctx.reply(msg);
    }

    // Extract distinct dates
    const dates = [...new Set(result.rows.map(r => r.order_date.toISOString().split("T")[0]))];
    dates.sort((a, b) => new Date(b) - new Date(a));

    // Count consecutive days
    let streak = 1;
    for (let i = 0; i < dates.length - 1; i++) {
      const current = new Date(dates[i]);
      const previous = new Date(dates[i + 1]);
      const diffDays = Math.floor((current - previous) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) streak++;
      else break;
    }

    const latest = new Date(dates[0]).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const eligible = streak >= 4;
    const description = eligible
      ? `🔥 <@${user.id}> has a **${streak}-day streak!** 🏆 Eligible for the **4-Day Streak — No Fee Order!**`
      : `📅 <@${user.id}> has a **${streak}-day streak** (last order on **${latest}**).`;

    const embed = new EmbedBuilder()
      .setTitle("📦 Order Streak")
      .setDescription(description)
      .setColor(eligible ? 0x57f287 : 0xf1c40f)
      .setFooter({
        text: `Requested by ${isSlash ? ctx.user.tag : ctx.author.tag}`,
      })
      .setTimestamp();

    if (isSlash) {
      await ctx.reply({
        embeds: [embed],
        ephemeral: true,
        allowedMentions: { users: [user.id] },
      });
    } else {
      await ctx.reply({ embeds: [embed] });
    }
  } catch (error) {
    console.error("streak error:", error);
    const msg = "❌ Failed to retrieve streak data.";
    if (isSlash) await ctx.reply({ content: msg, ephemeral: true });
    else await ctx.reply(msg);
  }
}
