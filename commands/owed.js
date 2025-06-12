const pool = require("../db");

module.exports = {
  name: "owed",
  description: "Show how much each user owes",
  async execute(message, args) {
    const staffRole = message.guild.roles.cache.find(
      (role) => role.name === "Staff"
    );

    if (!staffRole || !message.member.roles.cache.has(staffRole.id)) {
      return message.reply("❌ Only Staff can use this command.");
    }

    try {
      const result = await pool.query(
        "SELECT user_id, total, orders FROM owed ORDER BY total DESC"
      );

      if (result.rows.length === 0) {
        return message.reply("No one owes anything yet.");
      }

      let reply = "\uD83D\uDCB0 **Amounts Owed:**\n";
      for (const row of result.rows) {
        reply += `<@${row.user_id}> — **$${row.total}** (${row.orders} orders)\n`;
      }

      message.channel.send(reply);
    } catch (err) {
      console.error("Owed command error:", err);
      message.reply("❌ Failed to load owed data.");
    }
  },
};
