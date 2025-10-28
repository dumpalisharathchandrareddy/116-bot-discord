const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
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

      // Collector for confirm/retry actions
      const collector = interaction.channel.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          ["confirm_winner", "retry_winner"].includes(i.customId) &&
          i.message.interaction?.id === interaction.id,
        time: 60_000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "retry_winner") {
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
          // Lock interface
          await i.update({
            content: `✅ Winner confirmed: <@${currentWinnerId}>`,
            components: [],
          });

          // 🎉 Create giveaway winner embed
          const winnerEmbed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle("🎉 Congratulations!")
            .setDescription(
              `🥳 **<@${currentWinnerId}>**, you’ve won today’s giveaway!\n\n` +
              `🍽️ Your next order is **fee-free!**\n` +
              `⏰ Claim within **24h** by opening a ticket.`
            )
            .setFooter({ text: "116 | Daily Giveaway" })
            .setTimestamp();

          // Public announcement
          await interaction.channel.send({ embeds: [winnerEmbed] });

          // 📨 DM the winner (best effort)
          try {
            const user = await interaction.client.users.fetch(currentWinnerId);
            const dmEmbed = new EmbedBuilder()
              .setColor(0xf1c40f)
              .setTitle("🎉 You Won the 116 Giveaway!")
              .setDescription(
                `Hey <@${currentWinnerId}>! You’ve been selected as **today’s giveaway winner!** 🎁\n\n` +
                `🍽️ Your next order is **fee-free** (Uber fees & food still apply).\n` +
                `⏰ Claim your reward within **24 hours** by opening a ticket.`
              )
              .setFooter({ text: "116 | Daily Giveaway" })
              .setTimestamp();

            await user.send({ embeds: [dmEmbed] });
          } catch (err) {
            console.warn(`⚠️ Could not DM winner (${currentWinnerId}):`, err);
            await interaction.followUp({
              content: `⚠️ I couldn’t DM <@${currentWinnerId}>. They might have DMs turned off.`,
              ephemeral: true,
            });
          }

          collector.stop("confirmed");
        }
      });

      collector.on("end", async (_collected, reason) => {
        if (reason !== "confirmed") {
          try {
            await interaction.editReply({
              content: "⏱️ Timed out. No winner was confirmed.",
              components: [],
            });
          } catch {
            /* ignored */
          }
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
