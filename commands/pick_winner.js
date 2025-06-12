const pool = require("../db");

async function pickWinner(interaction) {
  try {
    const result = await pool.query("SELECT user_id FROM giveaway_entries");
    const entries = result.rows.map(row => row.user_id);

    if (entries.length < 20) {
      return interaction.reply({
        content: `❌ Not enough entries! 20 required. Currently: ${entries.length}.`,
        ephemeral: true,
      });
    }

    const winnerId = entries[Math.floor(Math.random() * entries.length)];

    await interaction.reply(
      `🎉 **Congratulations <@${winnerId}>!** You won today's giveaway! 🎁\n👉 Your next order will be **NO SERVICE FEE** (Uber fees & food still paid)`
    );
  } catch (err) {
    console.error("pickWinner error:", err);
    await interaction.reply({
      content: "❌ Failed to pick a winner due to a database error.",
      ephemeral: true,
    });
  }
}

module.exports = {
  pickWinner
};
