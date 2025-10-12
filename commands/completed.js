// commands/completed.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const pool = require("../db");

const COMPLETED_CATEGORY_ID = process.env.COMPLETED_CATEGORY_ID; // ID of the Completed Tickets category
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;               // ID of the log channel for completed tickets
const CUSTOMER_ROLE_ID = process.env.CUSTOMER_ROLE_ID;           // ID of the Customer role to assign
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const OWNER_ID = "666746569193816086";

// --- internal core used by both /completed and bridge.trigger ---
async function completeTicketCore({ client, actorUserId, channel }) {
  if (!channel?.name?.startsWith("ticket-")) {
    throw new Error("This command can only be used in ticket channels.");
  }

  const now = Date.now();

  // ✅ Update staff owed (if not OWNER)
  if (actorUserId !== OWNER_ID) {
    const result = await pool.query("SELECT * FROM owed WHERE user_id = $1", [actorUserId]);
    if (result.rows.length === 0) {
      await pool.query("INSERT INTO owed (user_id, orders, total) VALUES ($1, 1, 1)", [actorUserId]);
    } else {
      await pool.query(
        "UPDATE owed SET orders = orders + 1, total = total + 1 WHERE user_id = $1",
        [actorUserId]
      );
    }
  }

  // ✅ Set parent to Completed category
  await channel.setParent(COMPLETED_CATEGORY_ID, { lockPermissions: false });

  // ✅ Track or update completed timestamp
  await pool.query(
    `INSERT INTO completed_tickets (ticket_id, completed_at)
     VALUES ($1, $2)
     ON CONFLICT (ticket_id) DO UPDATE SET completed_at = EXCLUDED.completed_at`,
    [channel.id, now]
  );

  // ✅ Track member (non-staff) orders & give Customer role
  const members = channel.members;
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
  await channel.send(
    `✅ <@${ticketOwnerId}>, Your order has been marked as completed by <@${actorUserId}>, will automatically be deleted in ⏳ **2 hours**!\n`
  );

  // ── Ping ticket opener + short vouch prompt ──
  let ticketOwnerId = null;

  // 1) Try channel.topic (Ticket Tool stores ID there)
  if (channel.topic) {
    const m = channel.topic.match(/\d{17,19}/); // any 17-19-digit ID
    if (m) ticketOwnerId = m[0];
  }

  // 2) Fallback: first non-bot, non-staff member in the channel
  if (!ticketOwnerId) {
    for (const m of channel.members.values()) {
      if (!m.user.bot && !m.roles.cache.has(STAFF_ROLE_ID)) {
        ticketOwnerId = m.id;
        break;
      }
    }
  }

  // 3) Send the short thank-you / vouch prompt
  // if (ticketOwnerId) {
  //   await channel.send(
  //     `📦 <@${ticketOwnerId}>, your order is **complete** — thanks!\n` +
  //     `💬 Like the service? Drop a quick vouch in <#1405983244096372839>, tag <@&1405978890970861579>, and enter <#1405983236886102217>!`
  //   );
  // }

  // ✅ Log to Log Channel
  const logChannel = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) {
    await logChannel.send(
      `🗂️ Ticket \`${channel.name}\` was marked as completed by <@${actorUserId}> at <t:${Math.floor(now / 1000)}:f>.`
    );
  }

  // ✅ Schedule auto-delete in 2 hrs
  setTimeout(async () => {
    try {
      await channel.delete();
    } catch (err) {
      console.error("Failed to auto-delete ticket:", err);
    }
  }, 2 * 60 * 60 * 1000);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("completed")
    .setDescription("Mark this ticket completed, update owed and orders (Staff only)")
    .setDefaultMemberPermissions(null),

  // Original slash-command behavior (unchanged)
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
      await completeTicketCore({
        client: interaction.client,
        actorUserId: interaction.user.id,
        channel: interaction.channel,
      });

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
    } catch (err) {
      console.error("/completed command error:", err);
      await interaction.reply({
        content: "❌ Failed to complete the ticket or update data. Check bot permissions.",
        ephemeral: true,
      });
    }
  },
};

// --- Bridge entry point: allow ue-tracker to trigger without a slash interaction ---
module.exports.runDirect = async (client, { userId, channelId /* orderId, total unused */ }) => {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) throw new Error("Channel not found for runDirect");

    // In bridge mode, we intentionally bypass staff-role checks,
    // since ue-tracker is the trusted source.
    await completeTicketCore({
      client,
      actorUserId: userId,
      channel,
    });
  } catch (err) {
    console.error("runDirect (bridge) error:", err);
  }
};
