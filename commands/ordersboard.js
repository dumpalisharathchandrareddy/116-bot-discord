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
      // Acknowledge immediately to avoid 10062 (Unknown interaction)
      await interaction.deferReply();

      const limit = interaction.options.getInteger("limit") ?? 25;
      const download = interaction.options.getBoolean("download") ?? false;

      const { rows } = await db.query(
        download
          ? `SELECT user_id, total_orders FROM user_orders ORDER BY total_orders DESC`
          : `SELECT user_id, total_orders FROM user_orders ORDER BY total_orders DESC LIMIT $1`,
        download ? [] : [limit]
      );

      if (!rows.length) {
        return interaction.editReply({ content: "No orders recorded yet." });
      }

      if (download) {
        const header = "user_id,total_orders\n";
        const body = rows.map(r => `${r.user_id},${r.total_orders}`).join("\n");
        const csv = header + body;

        const file = new AttachmentBuilder(Buffer.from(csv, "utf8"), {
          name: "orders_leaderboard.csv",
        });

        return interaction.editReply({
          content: "📥 Orders leaderboard (all users):",
          files: [file],
        });
      }

      // Resolve usernames best-effort
      const resolved = await Promise.all(
        rows.map(async (r) => {
          try {
            const u = await interaction.client.users.fetch(r.user_id);
            return { mention: `<@${r.user_id}>`, total: r.total_orders, tag: u.tag };
          } catch {
            return { mention: `<@${r.user_id}>`, total: r.total_orders, tag: "Unknown" };
          }
        })
      );

      let desc = "";
      resolved.forEach((entry, i) => {
        const rank = i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        desc += `${rank} ${entry.mention} — **${entry.total}** orders\n`;
      });

      if (desc.length > 3800) {
        return interaction.editReply(
          "The leaderboard is too large to display. Use `/ordersboard download:true` to get a CSV of all users."
        );
      }

      const embed = new EmbedBuilder()
        .setTitle("📦 Orders Leaderboard")
        .setDescription(desc)
        .setColor(0x00b5ad)
        .setFooter({ text: `Showing top ${resolved.length}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("/ordersboard error:", err);
      const msg = "❌ Could not fetch the orders leaderboard right now.";
      try {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: msg });
        }
        return interaction.reply({ content: msg, ephemeral: true });
      } catch {
        // swallow final error
      }
    }
  },
};
