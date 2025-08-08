const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const pool = require("../db");

const COMPLETED_CATEGORY_ID = "1400611725702729848";
const LOG_CHANNEL_ID = "1400615782727290930";
const CUSTOMER_ROLE_ID = "1400611715388932108";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1400611714650607646";
const OWNER_ID = "666746569193816086";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("completed")
    .setDescription("Mark this ticket completed, update owed and orders (Staff only)")
    .setDefaultMemberPermissions(null),

  async execute(interaction) {
    if (!interaction.channel.name.startsWith("ticket-")) {
      return interaction.reply({
        content: "❌ This command can only be used in ticket channels.",
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
      const channelId = interaction.channel.id;
      const now = Date.now();

      // ✅ Update staff owed (if not OWNER)
      if (interaction.user.id !== OWNER_ID) {
        const userId = interaction.user.id;
        const result = await pool.query("SELECT * FROM owed WHERE user_id = $1", [userId]);

        if (result.rows.length === 0) {
          await pool.query("INSERT INTO owed (user_id, orders, total) VALUES ($1, 1, 1)", [userId]);
        } else {
          await pool.query("UPDATE owed SET orders = orders + 1, total = total + 1 WHERE user_id = $1", [userId]);
        }
      }

      // ✅ Set parent to Completed category
      await interaction.channel.setParent(COMPLETED_CATEGORY_ID, {
        lockPermissions: false,
      });

      // ✅ Track or update completed timestamp
      await pool.query(
        `INSERT INTO completed_tickets (ticket_id, completed_at)
         VALUES ($1, $2)
         ON CONFLICT (ticket_id) DO UPDATE SET completed_at = EXCLUDED.completed_at`,
        [channelId, now]
      );

      // ✅ Track member (non-staff) orders & give Customer role
      const members = interaction.channel.members;
      for (const member of members.values()) {
        if (member.user.bot) continue;
        if (member.roles.cache.has(STAFF_ROLE_ID)) continue;

        // Add Customer role if missing
        if (!member.roles.cache.has(CUSTOMER_ROLE_ID)) {
          await member.roles.add(CUSTOMER_ROLE_ID).catch(() => {});
        }

        // Update or insert order count
        const res = await pool.query("SELECT * FROM user_orders WHERE user_id = $1", [member.id]);
        if (res.rows.length === 0) {
          await pool.query("INSERT INTO user_orders (user_id, total_orders) VALUES ($1, 1)", [member.id]);
        } else {
          await pool.query("UPDATE user_orders SET total_orders = total_orders + 1 WHERE user_id = $1", [member.id]);
        }
      }

      // ✅ Confirmation Message
      await interaction.channel.send(
        `✅ This ticket has been marked as completed by <@${interaction.user.id}>!\n` +
        `⏳ This ticket will automatically close and deleted in **2 hours**.`
      );

      // ── Ping ticket opener + short vouch prompt ──
let ticketOwnerId = null;

// 1) Try channel.topic (Ticket Tool stores ID there)
if (interaction.channel.topic) {
  const m = interaction.channel.topic.match(/\d{17,19}/); // any 17-19-digit ID
  if (m) ticketOwnerId = m[0];
}

// 2) Fallback: first non-bot, non-staff member in the channel
if (!ticketOwnerId) {
  for (const m of interaction.channel.members.values()) {
    if (!m.user.bot && !m.roles.cache.has(STAFF_ROLE_ID)) {
      ticketOwnerId = m.id;
      break;
    }
  }
}

// 3) Send the short thank-you / vouch prompt
if (ticketOwnerId) {
  await interaction.channel.send(
    `📦 <@${ticketOwnerId}>, your order is **complete** — thanks!\n` +
    `💬 Like the service? Drop a quick vouch in <#1400619519986241566>, tag <@&1400611714650607646>, and enter <#1380321176676466723>!`
  );
}


      // ✅ Ephemeral Staff Summary
      let staffMessage = `✅ Ticket moved and logged. Auto-close scheduled.`;
      if (interaction.user.id !== OWNER_ID) {
        const owedData = await pool.query("SELECT * FROM owed WHERE user_id = $1", [interaction.user.id]);
        const orders = owedData.rows[0]?.orders || 0;
        const total = owedData.rows[0]?.total || 0;
        staffMessage =
          `✅ You (<@${interaction.user.id}>) have completed **${orders} orders** and owe **$${total}**.\n` +
          `Ticket moved and logged. Auto-close scheduled.`;
      }

      await interaction.reply({ content: staffMessage, ephemeral: true });

      // ✅ Log to Log Channel
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        await logChannel.send(
          `🗂️ Ticket \`${interaction.channel.name}\` was marked as completed by <@${interaction.user.id}> at <t:${Math.floor(now / 1000)}:f>.`
        );
      }

      // ✅ Schedule auto-delete in 2 hrs (only one scheduled timeout per call)
      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (err) {
          console.error("Failed to auto-delete ticket:", err);
        }
      }, 2 * 60 * 60 * 1000);
    } catch (err) {
      console.error("/completed command error:", err);
      await interaction.reply({
        content: "❌ Failed to complete the ticket or update data. Check bot permissions.",
        ephemeral: true,
      });
    }
  },
};
