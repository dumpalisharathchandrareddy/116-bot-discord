// commands/orders.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../db");

// Optionally set in Railway: SERVER_ORDERS_BONUS=100
const SERVER_ORDERS_BONUS = Number(process.env.SERVER_ORDERS_BONUS ?? 100);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("orders")
    .setDescription("Show total orders for the server or a specific user.")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User to check (optional)")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const target = interaction.options.getUser("user");

      if (target) {
        // User-specific total (no bonus)
        const { rows } = await db.query(
          "SELECT total_orders FROM user_orders WHERE user_id = $1",
          [target.id]
        );
        const total = Number(rows[0]?.total_orders ?? 0);

        const embed = new EmbedBuilder()
          .setTitle("📦 User Orders")
          .setDescription(`<@${target.id}> has **${total}** total order(s).`)
          .setColor(0x5865f2)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // Server total = sum of all users + bonus (display only)
      const { rows } = await db.query(
        "SELECT COALESCE(SUM(total_orders), 0) AS total FROM user_orders"
      );
      const rawTotal = Number(rows[0]?.total ?? 0);
      const displayTotal = rawTotal + SERVER_ORDERS_BONUS;

      const embed = new EmbedBuilder()
        .setTitle("🏷️ Server Orders")
        .setDescription(`Total orders recorded: **${displayTotal}**`)
        .setColor(0x57f287)
        .setFooter({ text: `Includes +${SERVER_ORDERS_BONUS} base bonus` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("/orders error:", err);
      const msg = "❌ Could not fetch orders right now.";
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ content: msg, ephemeral: true });
      }
      return interaction.reply({ content: msg, ephemeral: true });
    }
  },
};
