const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const pool = require("../db");

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
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

      const pickRandom = () => entries[Math.floor(Math.random() * entries.length)];
      let currentWinnerId = pickRandom();

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
        content:
          `👀 Randomly selected: <@${currentWinnerId}>\n\n` +
          `Press **Confirm** to announce or **Retry** to pick a new one.`,
        components: [row],
        ephemeral: true,
      });

      // Use a channel collector for maximum reliability; filter to just this interaction's buttons
      const collector = interaction.channel.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          ["confirm_winner", "retry_winner"].includes(i.customId) &&
          i.message.interaction?.id === interaction.id,
        time: 60_000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "retry_winner") {
          // Ensure a new winner (when possible)
          let next;
          do {
            next = pickRandom();
          } while (entries.length > 1 && next === currentWinnerId);
          currentWinnerId = next;

          return i.update({
            content:
              `👀 Randomly selected: <@${currentWinnerId}>\n\n` +
              `Press **Confirm** to announce or **Retry** to pick a new one.`,
            components: [row],
          });
        }

        if (i.customId === "confirm_winner") {
          // Lock the ephemeral UI
          await i.update({
            content: `✅ Winner confirmed: <@${currentWinnerId}>`,
            components: [],
          });

          // Public announce
          await interaction.channel.send(
            `🎉 **Congratulations <@${currentWinnerId}>!** You won today's giveaway! 🎁\n` +
              `👉 Your next order will be **NO SERVICE FEE** (Uber fees & food still paid)\n\n` +
              `🕒 Please claim your prize within **24 hours** by opening a ticket — or it will be **invalid**.`
          );

          // DM winner (best effort)
          try {
            const user = await interaction.client.users.fetch(currentWinnerId);
            await user.send(
              `🎉 You’ve been selected as the **winner** of today’s giveaway!\n\n` +
                `👉 Your next order will be **NO SERVICE FEE** (Uber fees & food still paid)\n` +
                `🕒 Please claim your prize within **24 hours** by opening a ticket — or it will be **invalid**.\n\n` +
                `If you believe this is a mistake, please contact staff.`
            );
          } catch (err) {
            console.warn(`⚠️ Could not DM winner (${currentWinnerId}):`, err);
            await interaction.followUp({
              content: `⚠️ I couldn’t DM <@${currentWinnerId}>. They might have DMs off.`,
              ephemeral: true,
            });
          }

          collector.stop("confirmed");
        }
      });

      collector.on("end", async (_collected, reason) => {
        if (reason !== "confirmed") {
          // Timeout path: clean up the ephemeral message if still editable
          try {
            await interaction.editReply({
              content: "⏱️ Timed out. No winner was confirmed.",
              components: [],
            });
          } catch { /* ignore if already edited/removed */ }
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
