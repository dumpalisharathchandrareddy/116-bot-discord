const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const pool = require("../db");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1369794789553475704";
const MIN_ENTRIES = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pick_winner")
    .setDescription("🎁 Pick (or repick) a giveaway winner (Staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID);
    if (!isStaff) {
      return interaction.reply({
        content: "❌ Only Staff can pick the giveaway winner.",
        ephemeral: true,
      });
    }

    try {
      const result = await pool.query("SELECT user_id FROM giveaway_entries");
      const entries = result.rows.map((row) => row.user_id);

      if (entries.length < MIN_ENTRIES) {
        return interaction.reply({
          content: `❌ Not enough entries! ${MIN_ENTRIES} required. Currently: ${entries.length}.`,
          ephemeral: true,
        });
      }

      const winnerId = entries[Math.floor(Math.random() * entries.length)];

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_winner")
          .setLabel("✅ Confirm")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("retry_winner")
          .setLabel("🔁 Retry")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content: `👀 Randomly selected: <@${winnerId}>\n\nPress **Confirm** to announce or **Retry** to pick a new one.`,
        components: [row],
        ephemeral: true,
      });

      const collector = interaction.channel.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          ["confirm_winner", "retry_winner"].includes(i.customId),
        time: 60_000,
        max: 1,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "retry_winner") {
          return module.exports.execute(interaction);
        }

        if (i.customId === "confirm_winner") {
          await i.update({
            content: `✅ Winner confirmed: <@${winnerId}>`,
            components: [],
            ephemeral: true,
          });

          await interaction.channel.send(
            `🎉 **Congratulations <@${winnerId}>!** You won today's giveaway! 🎁\n` +
              `👉 Your next order will be **NO SERVICE FEE** (Uber fees & food still paid)\n\n` +
              `🕒 Please claim your prize within **24 hours** by opening a ticket — or it will be **invalid**.`
          );

          try {
            const user = await interaction.client.users.fetch(winnerId);
            await user.send(
              `🎉 You’ve been selected as the **winner** of today’s giveaway!\n\n` +
                `👉 Your next order will be **NO SERVICE FEE** (Uber fees & food still paid)\n` +
                `🕒 Please claim your prize within **24 hours** by opening a ticket — or it will be **invalid**.\n\n` +
                `If you believe this is a mistake, please contact staff.`
            );
          } catch (err) {
            console.warn(`⚠️ Could not DM winner (${winnerId}):`, err);
            await interaction.followUp({
              content: `⚠️ I couldn’t DM <@${winnerId}>. They might have DMs off.`,
              ephemeral: true,
            });
          }
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          interaction.editReply({
            content: "⏱️ Timed out. No winner was confirmed.",
            components: [],
            ephemeral: true,
          });
        }
      });
    } catch (error) {
      console.error("pick_winner error:", error);
      return interaction.reply({
        content: "❌ Failed to pick a winner due to a database error.",
        ephemeral: true,
      });
    }
  },
};
