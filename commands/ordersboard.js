const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ordersboard")
    .setDescription("Show the orders leaderboard or download all users' order counts.")
    .addIntegerOption((opt) =>
      opt
        .setName("limit")
        .setDescription("How many to show (default 25, max 100).")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("download")
        .setDescription("Send a CSV of ALL users' order counts.")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const limit = interaction.options.getInteger("limit") ?? 25;
      const download = interaction.options.getBoolean("download") ?? false;

      // Pull all rows (needed for CSV) or just enough for leaderboard
      const { rows } = await db.query(
        download
          ? `SELECT user_id, total_orders FROM user_orders ORDER BY total_orders DESC`
          : `SELECT user_id, total_orders FROM user_orders ORDER BY total_orders DESC LIMIT $1`,
        download ? [] : [limit]
      );

      if (!rows.length) {
        return interaction.reply({
          content: "No orders recorded yet.",
          ephemeral: true,
        });
      }

      if (download) {
        // Build CSV for all users
        const header = "user_id,total_orders\n";
        const body = rows.map(r => `${r.user_id},${r.total_orders}`).join("\n");
        const csv = header + body;

        const file = new AttachmentBuilder(Buffer.from(csv, "utf8"), {
          name: "orders_leaderboard.csv",
        });

        return interaction.reply({
          content: "📥 Orders leaderboard (all users):",
          files: [file],
        });
      }

      // Build pretty leaderboard (mentions + counts)
      // Try to resolve usernames; fall back to mention if fetch fails
      const resolved = await Promise.all(
        rows.map(async (r) => {
          try {
            const u = await interaction.client.users.fetch(r.user_id);
            return { id: r.user_id, name: `${u.tag}`, mention: `<@${r.user_id}>`, total: r.total_orders };
          } catch {
            return { id: r.user_id, name: `Unknown`, mention: `<@${r.user_id}>`, total: r.total_orders };
          }
        })
      );

      let desc = "";
      resolved.forEach((entry, i) => {
        const rank =
          i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        desc += `${rank} ${entry.mention} — **${entry.total}** orders\n`;
      });

      // Discord message limit guard
      if (desc.length > 3800) {
        // too long → nudge to download mode
        return interaction.reply({
          content:
            "The leaderboard is too large to display. Use `/ordersboard download:true` to get a CSV of all users.",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📦 Orders Leaderboard")
        .setDescription(desc)
        .setColor(0x00b5ad)
        .setFooter({ text: `Showing top ${resolved.length}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("/ordersboard error:", err);
      const msg = "❌ Could not fetch the orders leaderboard right now.";
      if (interaction.deferred || interaction.replied)
        return interaction.followUp({ content: msg, ephemeral: true });
      return interaction.reply({ content: msg, ephemeral: true });
    }
  },
};
