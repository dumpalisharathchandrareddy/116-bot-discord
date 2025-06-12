const { EmbedBuilder } = require("discord.js");
const pool = require("../db");

const ENTRY_EMOJI = "🎁";
const MIN_ENTRIES = 20;

module.exports = {
  async startGiveaway(interaction) {
    try {
      const embed = new EmbedBuilder()
        .setTitle("🎁 Daily Giveaway - NO SERVICE FEE Order!")
        .setDescription(
          `✅ React with 🎁 to enter!\n` +
          `✅ Cost: **1 point**\n` +
          `✅ Minimum **${MIN_ENTRIES} entries required** for giveaway to run.\n\n` +
          `**Prize:** Your next order will be **NO SERVICE FEE** (you still pay Uber fees + food)`
        )
        .setColor(0xffc107)
        .setFooter({ text: "Daily Giveaway - Starts now" })
        .setTimestamp();

      const giveawayMessage = await interaction.channel.send({ embeds: [embed] });
      await giveawayMessage.react(ENTRY_EMOJI);

      await pool.query(
        `INSERT INTO giveaway_state (message_id, channel_id, is_active, prize) VALUES ($1, $2, $3, $4)`,
        [giveawayMessage.id, interaction.channel.id, true, "NO SERVICE FEE Order"]
      );

      await interaction.reply({ content: "✅ Giveaway started!", ephemeral: true });
    } catch (error) {
      console.error("startGiveaway error:", error);
    }
  },

  async pickWinner(interaction) {
    try {
      const result = await pool.query(`SELECT user_id FROM giveaway_entries`);
      const entries = result.rows.map(row => row.user_id);

      if (entries.length < MIN_ENTRIES) {
        return interaction.reply({
          content: `❌ Not enough entries! ${MIN_ENTRIES} required. Currently: ${entries.length}.`,
          ephemeral: true
        });
      }

      const winnerId = entries[Math.floor(Math.random() * entries.length)];
      await interaction.reply(
        `🎉 **Congratulations <@${winnerId}>!** You won today's giveaway! 🎁\n` +
        `👉 Your next order will be **NO SERVICE FEE** (Uber fees & food still paid)`
      );
    } catch (error) {
      console.error("pickWinner error:", error);
    }
  },

  async clearGiveaway(interaction) {
    try {
      await pool.query(`DELETE FROM giveaway_entries`);
      await pool.query(`DELETE FROM giveaway_state`);
      await interaction.reply({ content: "✅ Giveaway cleared!", ephemeral: true });
    } catch (error) {
      console.error("clearGiveaway error:", error);
    }
  },

  async handleReaction(reaction, user, client) {
    if (user.bot) return;

    try {
      const stateResult = await pool.query(`SELECT * FROM giveaway_state ORDER BY id DESC LIMIT 1`);
      const state = stateResult.rows[0];
      if (!state) return;

      if (
        reaction.message.id !== state.message_id ||
        reaction.message.channel.id !== state.channel_id ||
        reaction.emoji.name !== ENTRY_EMOJI
      ) return;

      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      const pointsResult = await pool.query(`SELECT points FROM points WHERE user_id = $1`, [user.id]);
      const userPoints = pointsResult.rows[0]?.points || 0;

      if (userPoints < 1) {
        await reaction.users.remove(user.id).catch(() => {});
        try {
          await user.send(
            `❌ You can't enter today's giveaway:\n` +
            `• You have **${userPoints} point(s)** (need at least 1)\n\n` +
            `👉 You must place an order **and vouch** to earn points.`
          );
        } catch {}
        return;
      }

      const alreadyEntered = await pool.query(`SELECT 1 FROM giveaway_entries WHERE user_id = $1`, [user.id]);
      if (alreadyEntered.rowCount > 0) return;

      await pool.query(`UPDATE points SET points = points - 1 WHERE user_id = $1`, [user.id]);
      await pool.query(`INSERT INTO giveaway_entries (user_id, entries) VALUES ($1, 1)`, [user.id]);

      try {
        await user.send(`✅ You successfully entered the giveaway! 1 point was deducted.`);
      } catch {}
    } catch (error) {
      console.error("handleReaction error:", error);
    }
  }
};
