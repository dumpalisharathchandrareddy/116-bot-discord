const { Events } = require("discord.js");
const db = require("../db.js");

const VOUCHES_CHANNEL_ID = "1400619519986241566";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const OWNER_ID = "1400611712104927232";

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    if (message.author.bot || message.channel.id !== VOUCHES_CHANNEL_ID) return;

    const userId = message.author.id;
    const hasImage = message.attachments.size > 0;
    const mentionsStaffRole = message.mentions.roles.has(STAFF_ROLE_ID);
    const mentionsStaffMember = message.mentions.members.some((m) =>
      m.roles.cache.has(STAFF_ROLE_ID)
    );
    const mentionsYou = message.mentions.users.has(OWNER_ID);
    const mentionsBot = message.mentions.users.has(client.user.id);

    const shouldAward =
      hasImage &&
      (mentionsStaffRole || mentionsStaffMember || mentionsYou || mentionsBot);

    if (!shouldAward) {
      await message.delete().catch(() => {});
      return;
    }

    // Prevent duplicate vouch rewards
    if (!client.awardedMessages) client.awardedMessages = new Set();
    if (client.awardedMessages.has(message.id)) return;
    client.awardedMessages.add(message.id);

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member || member.roles.cache.has(STAFF_ROLE_ID) || userId === OWNER_ID) return;

    // ➤ Give user +1 point for vouching
    await db.query(`
      INSERT INTO points (user_id, points)
      VALUES ($1, 1)
      ON CONFLICT (user_id) DO UPDATE SET points = points.points + 1
    `, [userId]);

    // ➤ Attempt referral logic
    const mentioned = [...message.mentions.users.values()].filter(u => u.id !== userId);
    const uniqueIds = [...new Set(mentioned.map(u => u.id))];

    // Only one valid, unique user mentioned
    if (uniqueIds.length === 1) {
      const refId = uniqueIds[0];

      const alreadyReferred = await db.query(
        `SELECT * FROM referrals WHERE user_id = $1`,
        [userId]
      );

      const refMember = await message.guild.members.fetch(refId).catch(() => null);
      const isReferrerStaff = refMember?.roles.cache.has(STAFF_ROLE_ID);

      if (alreadyReferred.rowCount === 0 && !isReferrerStaff && refId !== OWNER_ID) {
        await db.query(`
          INSERT INTO referrals (user_id, referred_by, referral_count)
          VALUES ($1, $2, 1)
        `, [userId, refId]);

        await db.query(`
          INSERT INTO points (user_id, points)
          VALUES ($1, 5)
          ON CONFLICT (user_id) DO UPDATE SET points = points.points + 5
        `, [refId]);

        await db.query(`
          UPDATE referrals
          SET referral_count = referral_count + 1
          WHERE user_id = $1
        `, [refId]);

        await message.channel.send(
          `🎉 Referral bonus! <@${refId}> earned **5 points** for referring <@${userId}>.`
        );
      }
    }

    const { rows } = await db.query(`SELECT points FROM points WHERE user_id = $1`, [userId]);
    const newPoints = rows[0]?.points || 1;

    await message.reply(
      `✅ Success! Point awarded. <@${userId}> now has **${newPoints}** points 🎉`
    );
  },
};
