const pool = require("../db");

const OWNER_ID = "666746569193816086"; // Only YOU can run this

module.exports = {
  name: "paid",
  description: "Reset owed balance for a user",
  async execute(message, args) {
    if (message.author.id !== OWNER_ID) {
      return message.reply("❌ Only the bot owner can use this command.");
    }

    const mentioned = message.mentions.users.first();
    const method = args.slice(1).join(" ") || "unspecified method";

    if (!mentioned) {
      return message.reply("❌ Please mention the user who paid.");
    }

    try {
      const result = await pool.query("SELECT * FROM owed WHERE user_id = $1", [mentioned.id]);
      if (result.rows.length === 0) {
        return message.reply("That user doesn't owe anything.");
      }

      await pool.query("DELETE FROM owed WHERE user_id = $1", [mentioned.id]);
      message.channel.send(
        `✅ Cleared owed balance for <@${mentioned.id}> (Paid via **${method}**).`
      );
    } catch (error) {
      console.error("paid.js error:", error);
      message.reply("❌ Failed to clear owed balance due to an error.");
    }
  },
};
