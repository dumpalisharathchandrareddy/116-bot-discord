const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const giveawayStateFile = path.join(__dirname, "../giveaway_state.json");
const giveawayEntriesFile = path.join(__dirname, "../giveaway_entries.json");
const pointsFile = path.join(__dirname, "../points.json");
const owedFile = path.join(__dirname, "../owed.json");

const ENTRY_EMOJI = "🎁"; // Gift emoji
const MIN_ENTRIES = 20;

module.exports = {
  async startGiveaway(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("🎁 Daily Giveaway - NO SERVICE FEE Order!")
      .setDescription(
        `✅ React with 🎁 to enter!\n` +
          `✅ Cost: **1 point**\n` +
          `✅ Must have **1+ completed order today**\n` +
          `✅ Minimum **${MIN_ENTRIES} entries required** for giveaway to run.\n\n` +
          `**Prize:** Your next order will be **NO SERVICE FEE** (you still pay Uber fees + food)`,
      )
      .setColor(0xffc107)
      .setFooter({ text: "Daily Giveaway - Ends Today" })
      .setTimestamp();

    const giveawayMessage = await interaction.channel.send({ embeds: [embed] });
    await giveawayMessage.react(ENTRY_EMOJI);

    const state = {
      messageId: giveawayMessage.id,
      channelId: interaction.channel.id,
    };
    fs.writeFileSync(giveawayStateFile, JSON.stringify(state, null, 2));

    await interaction.reply({
      content: "✅ Giveaway started!",
      ephemeral: true,
    });
  },

  async pickWinner(interaction) {
    let entries = [];
    try {
      entries = JSON.parse(fs.readFileSync(giveawayEntriesFile, "utf-8"));
    } catch {
      entries = [];
    }

    if (entries.length < MIN_ENTRIES) {
      return interaction.reply({
        content: `❌ Not enough entries! ${MIN_ENTRIES} required. Currently: ${entries.length}.`,
        ephemeral: true,
      });
    }

    const winnerId = entries[Math.floor(Math.random() * entries.length)];
    await interaction.reply(
      `🎉 **Congratulations <@${winnerId}>!** You won today's giveaway! 🎁\n` +
        `👉 Your next order will be **NO SERVICE FEE** (Uber fees & food still paid)`,
    );
  },

  async clearGiveaway(interaction) {
    fs.writeFileSync(giveawayEntriesFile, "[]");
    fs.writeFileSync(giveawayStateFile, "{}");

    await interaction.reply({
      content: "✅ Giveaway cleared!",
      ephemeral: true,
    });
  },

  async handleReaction(reaction, user, client) {
    if (user.bot) return;

    let state = {};
    try {
      state = JSON.parse(fs.readFileSync(giveawayStateFile));
    } catch {
      state = {};
    }

    if (
      reaction.message.id !== state.messageId ||
      reaction.message.channel.id !== state.channelId
    ) {
      return;
    }

    if (reaction.emoji.name !== ENTRY_EMOJI) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    let points = {};
    try {
      points = JSON.parse(fs.readFileSync(pointsFile));
    } catch {
      points = {};
    }

    let owed = {};
    try {
      owed = JSON.parse(fs.readFileSync(owedFile));
    } catch {
      owed = {};
    }

    const hasPoints = (points[user.id] || 0) >= 1;
    const hasCompletedOrder = owed[user.id]?.orders >= 1;

    if (!hasPoints || !hasCompletedOrder) {
      await reaction.users.remove(user.id).catch(() => {});
      try {
        await user.send(
          `❌ You cannot enter today's giveaway:\n` +
            `• 1+ point required → You have **${points[user.id] || 0}**\n` +
            `• Completed order required → You have **${owed[user.id]?.orders || 0}**\n\n` +
            `Please try again tomorrow!`,
        );
      } catch {}
      return;
    }

    points[user.id] -= 1;
    fs.writeFileSync(pointsFile, JSON.stringify(points, null, 2));

    let entries = [];
    try {
      entries = JSON.parse(fs.readFileSync(giveawayEntriesFile));
    } catch {
      entries = [];
    }

    if (!entries.includes(user.id)) {
      entries.push(user.id);
      fs.writeFileSync(giveawayEntriesFile, JSON.stringify(entries, null, 2));

      try {
        await user.send(
          `✅ You entered the giveaway! 🎁 1 point was deducted.`,
        );
      } catch {}
    }
  },
};
