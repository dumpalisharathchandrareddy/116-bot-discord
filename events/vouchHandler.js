const { Events } = require("discord.js");
const fs = require("fs");
const path = require("path");

const VOUCHES_CHANNEL_ID = "1380323340987797635";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const OWNER_ID = "666746569193816086";

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    if (message.author.bot) return;

    const userId = message.author.id;

    const isVouchChannel = message.channel.id === VOUCHES_CHANNEL_ID;
    const hasImage = message.attachments.size > 0;
    const mentionsStaffRole = message.mentions.roles.has(STAFF_ROLE_ID);
    const mentionsStaffMember = message.mentions.members.some((member) =>
      member.roles.cache.has(STAFF_ROLE_ID),
    );
    const mentionsYou = message.mentions.users.has(OWNER_ID);
    const mentionsBot = message.mentions.users.has(client.user.id);

    const shouldAward =
      hasImage &&
      (mentionsStaffRole || mentionsStaffMember || mentionsYou || mentionsBot);

    if (!isVouchChannel) return;

    // ✅ If NOT a valid vouch → DELETE
    if (!shouldAward) {
      await message.delete().catch(console.error);
      return;
    }

    // 🛡️ Safety: Prevent duplicate award
    if (!client.awardedMessages) client.awardedMessages = new Set();
    if (client.awardedMessages.has(message.id)) return;
    client.awardedMessages.add(message.id);

    // 🛡️ Safety: Owner and Staff do NOT get points
    const member = await message.guild.members.fetch(userId).catch(() => null);
    const isStaff = member?.roles.cache.has(STAFF_ROLE_ID);

    if (userId === OWNER_ID || isStaff) return;

    // ✅ LOAD POINTS
    const pointsFile = path.join(__dirname, "../points.json");
    let points = {};
    try {
      points = JSON.parse(fs.readFileSync(pointsFile, "utf-8"));
    } catch {
      points = {};
    }

    // ✅ LOAD REFERRALS
    const referralPath = path.join(__dirname, "../referrals.json");
    let referralData = {};
    try {
      referralData = JSON.parse(fs.readFileSync(referralPath, "utf-8"));
    } catch {
      referralData = {};
    }

    // ✅ AWARD POINT
    points[userId] = (points[userId] || 0) + 1;

    // ✅ HANDLE REFERRAL
    const possibleReferrer = message.mentions.users.find(
      (u) => u.id !== userId,
    );
    const isFirstVouch = !referralData[userId];

    if (possibleReferrer && isFirstVouch) {
      const refUser = await message.guild.members
        .fetch(possibleReferrer.id)
        .catch(() => null);
      const isReferrerStaff = refUser?.roles.cache.has(STAFF_ROLE_ID);

      if (!isReferrerStaff) {
        points[possibleReferrer.id] = (points[possibleReferrer.id] || 0) + 5;
        referralData[userId] = possibleReferrer.id;

        fs.writeFileSync(referralPath, JSON.stringify(referralData, null, 2));
        await message.channel.send(
          `🎉 Referral bonus! <@${possibleReferrer.id}> earned **5 points** for referring <@${userId}>.`,
        );
      }
    }

    // ✅ SAVE POINTS
    fs.writeFileSync(pointsFile, JSON.stringify(points, null, 2));

    // ✅ REPLY SUCCESS
    await message.reply(
      `✅ Success! Point awarded. <@${userId}> now has **${points[userId]}** points 🎉`,
    );
  },
};
