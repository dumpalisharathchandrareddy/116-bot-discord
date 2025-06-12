const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const pool = require("../db");

const COMPLETED_CATEGORY_ID = "1380405804267606148";
const LOG_CHANNEL_ID = "1374665062635147304";
const CUSTOMER_ROLE_ID = "1378016352169754695";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1369794789553475704";
const OWNER_ID = "666746569193816086";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("completed")
    .setDescription(
      "Mark this ticket completed, update owed, assign Customer, auto-close (Staff only)"
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!interaction.channel.name.startsWith("ticket-")) {
      return interaction.reply({
        content: "This command can only be used in ticket channels.",
        ephemeral: true,
      });
    }

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({
        content: "❌ Only Staff can use this command.",
        ephemeral: true,
      });
    }

    try {
      if (interaction.user.id !== OWNER_ID) {
        const userId = interaction.user.id;
        const result = await pool.query("SELECT * FROM owed WHERE user_id = $1", [userId]);

        if (result.rows.length === 0) {
          await pool.query("INSERT INTO owed (user_id, orders, total) VALUES ($1, 1, 1)", [userId]);
        } else {
          await pool.query(
            "UPDATE owed SET orders = orders + 1, total = total + 1 WHERE user_id = $1",
            [userId]
          );
        }
      }

      await interaction.channel.setParent(COMPLETED_CATEGORY_ID, {
        lockPermissions: false,
      });

      const customerRole = interaction.guild.roles.cache.get(CUSTOMER_ROLE_ID);
      if (customerRole) {
        const members = interaction.channel.members;
        members.forEach((member) => {
          if (member.user.bot) return;
          if (member.roles.cache.has(STAFF_ROLE_ID)) return;
          if (!member.roles.cache.has(customerRole.id)) {
            member.roles.add(customerRole).catch(() => {});
          }
        });
      }

      await interaction.channel.send(
        `✅ This ticket has been marked as completed by <@${interaction.user.id}>!\n` +
        `⏳ This ticket will automatically close in **2.5 hours**.`
      );

      let staffMessage = `✅ Ticket moved and logged. Auto-close scheduled.`;
      if (interaction.user.id !== OWNER_ID) {
        const owedData = await pool.query("SELECT * FROM owed WHERE user_id = $1", [interaction.user.id]);
        const orders = owedData.rows[0]?.orders || 0;
        const total = owedData.rows[0]?.total || 0;
        staffMessage =
          `✅ You (<@${interaction.user.id}>) have completed **${orders} orders** and owe **$${total}**.\n` +
          `Ticket moved and logged. Auto-close scheduled.`;
      }

      await interaction.reply({
        content: staffMessage,
        ephemeral: true,
      });

      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        await logChannel.send(
          `🗂️ Ticket \`${interaction.channel.name}\` was marked as completed and moved by <@${interaction.user.id}> at <t:${Math.floor(Date.now() / 1000)}:f>.`
        );
      }

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (err) {
          console.error("Failed to auto-delete ticket:", err);
        }
      }, 9000000);
    } catch (err) {
      console.error("/completed command error:", err);
      await interaction.reply({
        content:
          "❌ Failed to complete the ticket or update owed data. Check bot permissions!",
        ephemeral: true,
      });
    }
  },
};
