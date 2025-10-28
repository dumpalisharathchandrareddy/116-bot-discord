const { Events, EmbedBuilder } = require("discord.js");
const db = require("../db.js");

const VOUCHES_CHANNEL_ID = process.env.VOUCHES_CHANNEL_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID;

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    try {
      if (message.author.bot || message.channel.id !== VOUCHES_CHANNEL_ID) return;

      const userId = message.author.id;
      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (!member) return;

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

      // ❌ Handle missing image or mention
      if (!shouldAward) {
        await message.delete().catch(() => {});

        const dmEmbed = new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle("⚠️ Vouch Not Counted")
          .setDescription(
            `Hey <@${userId}>, your vouch wasn’t counted because it didn’t meet the vouch rules.\n\n` +
            `❌ **Possible reasons:**\n• Missing clear food image\n• Didn’t tag a Staff, Owner, or 116 Bot\n\n` +
            `✅ **How to fix:**\n1️⃣ Post a clear food or order photo\n2️⃣ Mention a Staff, Owner, or the 116 Bot\n3️⃣ Make sure the order was placed today\n\n` +
            `Try again after fixing these — thanks for helping keep things fair! 🍽️`
          )
          .setFooter({ text: "116 | Vouch Rules" })
          .setTimestamp();

        try {
          await member.send({ embeds: [dmEmbed] });
        } catch {
          console.log(`⚠️ Could not DM ${userId} (DMs closed).`);
        }
        return;
      }

      // 🧩 Avoid duplicates
      if (!client.awardedMessages) client.awardedMessages = new Set();
      if (client.awardedMessages.has(message.id)) return;
      client.awardedMessages.add(message.id);

      const isStaff = member.roles.cache.has(STAFF_ROLE_ID);
      const isOwnerRole = member.roles.cache.has(OWNER_ROLE_ID);
      if (isStaff || isOwnerRole) return;

      // 🧩 Check if user has an order today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { rows: orderRows } = await db.query(
        `SELECT 1 FROM orders WHERE user_id = $1 AND order_date >= $2 LIMIT 1`,
        [userId, today]
      );

      if (orderRows.length === 0) {
        await message.delete().catch(() => {});
        const dmEmbed = new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle("⚠️ Vouch Not Counted — No Order Found")
          .setDescription(
            `Hey <@${userId}>, your vouch wasn’t counted because you haven’t placed an order today.\n\n` +
            `✅ **How to fix:**\n1️⃣ Place an order first today\n2️⃣ Then post your food photo & tag a Staff or 116 Bot\n\n` +
            `Vouches only count for same-day orders! 🍔`
          )
          .setFooter({ text: "116 | Vouch Rules" })
          .setTimestamp();
        try {
          await member.send({ embeds: [dmEmbed] });
        } catch {
          console.log(`⚠️ Could not DM ${userId} (DMs closed).`);
        }
        return;
      }

      // 🟢 Award +1 point
      await db.query(
        `
        INSERT INTO points AS p (user_id, points)
        VALUES ($1, 1)
        ON CONFLICT (user_id)
        DO UPDATE SET points = COALESCE(p.points, 0) + EXCLUDED.points
        `,
        [userId]
      );

      // ➤ Referral logic
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
          await db.query(
            `
            INSERT INTO referrals (user_id, referred_by, referral_count)
            VALUES ($1, $2, 1)
            ON CONFLICT (user_id)
            DO UPDATE SET referred_by = EXCLUDED.referred_by
            `,
            [userId, refId]
          );

          await db.query(
            `
            INSERT INTO points AS p (user_id, points)
            VALUES ($1, 5)
            ON CONFLICT (user_id)
            DO UPDATE SET points = COALESCE(p.points, 0) + EXCLUDED.points
            `,
            [refId]
          );

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

      // ✅ Success embed
      const { rows } = await db.query(`SELECT points FROM points WHERE user_id = $1`, [userId]);
      const newPoints = rows[0]?.points ?? 1;

      const successEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ Vouch Recorded!")
        .setDescription(
          `⭐ <@${userId}>, your vouch was counted successfully!\nYou earned **1 point** for your order today.\n` +
          `You now have **${newPoints} points**.`
        )
        .setFooter({ text: "116 | Vouch Rewards" })
        .setTimestamp();

      await message.reply({ embeds: [successEmbed], allowedMentions: { users: [userId] } });

    } catch (err) {
      console.error("vouchHandler execute error:", err);
    }
  },
};
