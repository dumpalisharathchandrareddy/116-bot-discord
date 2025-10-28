// events/giveawayHandler.js
const { EmbedBuilder } = require("discord.js");
const pool = require("../db");

// CONFIG
const ENTRY_EMOJI = "🎁"; // React with this to enter

module.exports = {
  /**
   * Starts a giveaway in the current channel.
   * NOTE: This function does NOT reply to the interaction. Let the slash command do defer/editReply.
   * Returns { messageId, channelId } on success for the caller to use.
   */
  async startGiveaway(interaction) {
    // Create the entry embed
    const embed = new EmbedBuilder()
      .setTitle("🎁 Daily Giveaway - NO SERVICE FEE!")
      .setDescription(
        [
          "✅ React with 🎁 to enter!",
          "Cost: **1 point**",
          "🎯 Giveaway winner will get a DM when announced.",
          "",
          "**Prize:** Your next order will be **NO SERVICE FEE**"
        ].join("\n")
      )
      .setColor(0xffc107)
      .setFooter({ text: "Daily Giveaway - Starts now" })
      .setTimestamp();

    // Send the embed & add the reaction
    const giveawayMessage = await interaction.channel.send({ embeds: [embed] });
    await giveawayMessage.react(ENTRY_EMOJI);

    // Mark state as active for this message
    await pool.query(
      `INSERT INTO giveaway_state (message_id, channel_id, is_active, prize)
       VALUES ($1, $2, true, $3)`,
      [giveawayMessage.id, interaction.channel.id, "NO SERVICE FEE Order"]
    );

    return { messageId: giveawayMessage.id, channelId: interaction.channel.id };
  },

  /**
   * Picks a random winner from current entries.
   * NOTE: Does NOT reply to the interaction. Returns { picked: boolean, winnerId?: string }.
   * Also marks the active giveaway as inactive when a winner is picked.
   */
  async pickWinner() {
    // Get entries
    const { rows } = await pool.query(`SELECT user_id FROM giveaway_entries`);
    if (rows.length === 0) return { picked: false };

    const winnerId = rows[Math.floor(Math.random() * rows.length)].user_id;

    // Mark giveaway inactive (optional but recommended)
    await pool.query(
      `UPDATE giveaway_state SET is_active = false WHERE is_active = true`
    );

    return { picked: true, winnerId };
  },

  /**
   * Clears all giveaway data (entries + state).
   * NOTE: Does NOT reply to the interaction. Returns { cleared: true }.
   */
  async clearGiveaway() {
    await pool.query(`DELETE FROM giveaway_entries`);
    await pool.query(`DELETE FROM giveaway_state`);
    return { cleared: true };
  },

  /**
   * Handles a reaction add for entry.
   * Deducts 1 point atomically (as much as possible without DB constraints) and records the entry.
   */
  async handleReaction(reaction, user, client) {
    if (user.bot) return;

    try {
      // Ensure full objects if partials are enabled
      if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
      }
      if (reaction.message?.partial) {
        try { await reaction.message.fetch(); } catch { return; }
      }

      // Only process unicode 🎁 on the active giveaway
      const stateResult = await pool.query(
        `SELECT * FROM giveaway_state WHERE is_active = true ORDER BY id DESC LIMIT 1`
      );
      const state = stateResult.rows[0];
      if (!state) return;

      if (
        reaction.message.id !== state.message_id ||
        reaction.message.channel.id !== state.channel_id ||
        reaction.emoji.name !== ENTRY_EMOJI
      ) {
        return;
      }

      // Must be a guild member
      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      // Current points
      const pointsResult = await pool.query(
        `SELECT points FROM points WHERE user_id = $1`,
        [user.id]
      );
      const userPoints = pointsResult.rows[0]?.points || 0;

      if (userPoints < 1) {
        // Not enough points: remove reaction & DM
        await reaction.users.remove(user.id).catch(() => {});
        try {
          await user.send(
            [
              `❌ You can't enter today's giveaway:`,
              `• You have **${userPoints} point(s)** (need at least 1)`,
              ``,
              `👉 Earn points by placing an order **and vouching**.`
            ].join("\n")
          );
        } catch {}
        return;
      }

      // Prevent duplicates (best-effort without a unique constraint)
      const alreadyEntered = await pool.query(
        `SELECT 1 FROM giveaway_entries WHERE user_id = $1 LIMIT 1`,
        [user.id]
      );
      if (alreadyEntered.rowCount > 0) {
        try {
          await user.send(
            `⚠️ You already joined the giveaway! If you unreact, your point will NOT be refunded.`
          );
        } catch {}
        return;
      }

      // Attempt an atomic-ish deduction + insert (race-safe in most cases)
      // This avoids negative points if two fast reactions happen.
      const res = await pool.query(
        `
        WITH deducted AS (
          UPDATE points
            SET points = points - 1
            WHERE user_id = $1 AND points >= 1
            RETURNING user_id
        )
        INSERT INTO giveaway_entries (user_id, entries)
        SELECT user_id, 1 FROM deducted
        WHERE NOT EXISTS (SELECT 1 FROM giveaway_entries ge WHERE ge.user_id = $1)
        RETURNING user_id
        `,
        [user.id]
      );

      if (res.rowCount === 0) {
        // Either not enough points anymore OR duplicate slipped in under race
        await reaction.users.remove(user.id).catch(() => {});
        try {
          await user.send(
            `❌ Entry failed — you may have **insufficient points** or already **joined**.`
          );
        } catch {}
        return;
      }

      // Success DM
      try {
        await user.send(`✅ You successfully entered the giveaway! 1 point was deducted.`);
      } catch {}
    } catch (error) {
      console.error("handleReaction error:", error);
    }
  },
};
