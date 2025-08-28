// events/vouchHandler.js
const { Events } = require("discord.js");
const db = require("../db.js");

const VOUCHES_CHANNEL_ID = process.env.VOUCHES_CHANNEL_ID; // Channel where vouches are posted
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;           // Staff role id
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID;           // Owner role id

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    try {
      // Only handle non-bot messages in the vouches channel
      if (message.author.bot || message.channel.id !== VOUCHES_CHANNEL_ID) return;

      const userId = message.author.id;

      const hasImage = message.attachments.size > 0;
      const mentionsStaffRole = message.mentions.roles.has(STAFF_ROLE_ID);
      const mentionsStaffMember = message.mentions.members.some((m) =>
        m.roles.cache.has(STAFF_ROLE_ID)
      );
      const mentionsOwnerRole = message.mentions.members.some((m) =>
        m.roles.cache.has(OWNER_ROLE_ID)
      );
      const mentionsBot = message.mentions.users.has(client.user.id);

      const shouldAward =
        hasImage && (mentionsStaffRole || mentionsStaffMember || mentionsOwnerRole || mentionsBot);

      if (!shouldAward) {
        // Keep the channel clean if it doesn't meet the vouch rules
        await message.delete().catch(() => {});
        return;
      }

      // Prevent duplicate vouch rewards (idempotency on the message)
      if (!client.awardedMessages) client.awardedMessages = new Set();
      if (client.awardedMessages.has(message.id)) return;
      client.awardedMessages.add(message.id);

      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      const isStaff = member.roles.cache.has(STAFF_ROLE_ID);
      const isOwnerRole = member.roles.cache.has(OWNER_ROLE_ID);

      // Don't award staff or owners (role-based)
      if (isStaff || isOwnerRole) return;

      // ➤ Give user +1 point for vouching (alias table to avoid "points is ambiguous")
      await db.query(
        `
        INSERT INTO points AS p (user_id, points)
        VALUES ($1, 1)
        ON CONFLICT (user_id)
        DO UPDATE SET points = COALESCE(p.points, 0) + EXCLUDED.points
        `,
        [userId]
      );

      // ➤ Attempt referral logic
      // Only one unique non-self user mentioned
      const mentioned = [...message.mentions.users.values()].filter((u) => u.id !== userId);
      const uniqueIds = [...new Set(mentioned.map((u) => u.id))];

      if (uniqueIds.length === 1) {
        const refId = uniqueIds[0];

        const alreadyReferred = await db.query(
          `SELECT 1 FROM referrals WHERE user_id = $1 LIMIT 1`,
          [userId]
        );

        const refMember = await message.guild.members.fetch(refId).catch(() => null);
        const isReferrerStaff = refMember?.roles.cache.has(STAFF_ROLE_ID);
        const isReferrerOwnerRole = refMember?.roles.cache.has(OWNER_ROLE_ID);

        if (alreadyReferred.rowCount === 0 && !isReferrerStaff && !isReferrerOwnerRole) {
          // Record the referral (keep latest referrer if retried)
          await db.query(
            `
            INSERT INTO referrals (user_id, referred_by, referral_count)
            VALUES ($1, $2, 1)
            ON CONFLICT (user_id)
            DO UPDATE SET referred_by = EXCLUDED.referred_by
            `,
            [userId, refId]
          );

          // Award referrer +5 points (alias table to avoid ambiguity)
          await db.query(
            `
            INSERT INTO points AS p (user_id, points)
            VALUES ($1, 5)
            ON CONFLICT (user_id)
            DO UPDATE SET points = COALESCE(p.points, 0) + EXCLUDED.points
            `,
            [refId]
          );

          // (Optional) Keep a running count for the referrer themselves.
          await db.query(
            `
            INSERT INTO referrals AS r (user_id, referred_by, referral_count)
            VALUES ($1, NULL, 1)
            ON CONFLICT (user_id)
            DO UPDATE SET referral_count = r.referral_count + 1
            `,
            [refId]
          );

          await message.channel.send(
            `🎉 Referral bonus! <@${refId}> earned **5 points** for referring <@${userId}>.`
          );
        }
      }

      // Fetch updated points
      const { rows } = await db.query(`SELECT points FROM points WHERE user_id = $1`, [userId]);
      const newPoints = rows[0]?.points ?? 1;

      await message.reply(
        `✅ Success! Point awarded. <@${userId}> now has **${newPoints}** points 🎉`
      );
    } catch (err) {
      console.error("vouchHandler execute error:", err);
      // Avoid throwing to the client 'error' event; optionally notify channel quietly
    }
  },
};
