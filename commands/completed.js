const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const pool = require("../db");

const COMPLETED_CATEGORY_ID = process.env.COMPLETED_CATEGORY_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const CUSTOMER_ROLE_ID = process.env.CUSTOMER_ROLE_ID;
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

  // ✅ Move to Completed category
  await channel.setParent(COMPLETED_CATEGORY_ID, { lockPermissions: false });

  // ✅ Track completed timestamp
  await pool.query(
    `INSERT INTO completed_tickets (ticket_id, completed_at)
     VALUES ($1, $2)
     ON CONFLICT (ticket_id) DO UPDATE SET completed_at = EXCLUDED.completed_at`,
    [channel.id, now]
  );

  // ✅ Track customers and add Customer role
  const members = channel.members;
  for (const member of members.values()) {
    if (member.user.bot) continue;
    if (member.roles.cache.has(STAFF_ROLE_ID)) continue;

    // Add Customer role if missing
    if (!member.roles.cache.has(CUSTOMER_ROLE_ID)) {
      await member.roles.add(CUSTOMER_ROLE_ID).catch(() => {});
    }

    // Update or insert user order count
    const res = await pool.query("SELECT * FROM user_orders WHERE user_id = $1", [member.id]);
    if (res.rows.length === 0) {
      await pool.query("INSERT INTO user_orders (user_id, total_orders) VALUES ($1, 1)", [member.id]);
    } else {
      await pool.query("UPDATE user_orders SET total_orders = total_orders + 1 WHERE user_id = $1", [member.id]);
    }
  }

  // ── Determine ticket opener (Ticket Tool → fallback to non-staff) ──
  let ticketOwnerId = null;
  if (channel.topic) {
    const m = channel.topic.match(/\d{17,19}/);
    if (m) ticketOwnerId = m[0];
  }

  if (!ticketOwnerId) {
    for (const m of channel.members.values()) {
      if (!m.user.bot && !m.roles.cache.has(STAFF_ROLE_ID)) {
        ticketOwnerId = m.id;
        break;
      }
    }
  }

  // ✅ Log order date in DB (for streak tracking)
if (ticketOwnerId) {
  try {
    // Ensure the 'orders' table exists before inserting
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        order_date TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Insert the order record
    await pool.query("INSERT INTO orders (user_id, order_date) VALUES ($1, NOW())", [ticketOwnerId]);
    console.log(`✅ Logged order for user ${ticketOwnerId}`);
  } catch (err) {
    console.error("❌ Failed to log order date:", err);
  }
}


  // ── Build Embeds ──
  const actor = await channel.guild.members.fetch(actorUserId);

  // 🎯 Ticket Completion Embed
  const completeEmbed = new EmbedBuilder()
    .setColor(0x57f287)
    .setDescription(
      ticketOwnerId
        ? `✅ <@${ticketOwnerId}>, your order has been marked as **completed**!\nMarked by: **${actor.user.username}**\n\n🕒 This ticket will be deleted in **2 hours**.`
        : `✅ This order has been marked as **completed** by **${actor.user.username}**.\n\n🕒 This ticket will be deleted in **2 hours**.`
    )
    .setFooter({ text: "116 | Order Completion" })
    .setTimestamp();

  await channel.send({
    embeds: [completeEmbed],
    allowedMentions: ticketOwnerId ? { users: [ticketOwnerId] } : { parse: [] },
  });

  // 🗂️ Log Embed
  const logChannel = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel) {
    const logEmbed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("🎟️ Ticket Completed")
      .setDescription(
        `**Ticket:** ${channel.name}\n` +
        `**Marked by:** ${actor.user.username}\n` +
        (ticketOwnerId ? `**Customer:** <@${ticketOwnerId}>\n` : "") +
        `**Time:** <t:${Math.floor(now / 1000)}:f>`
      )
      .setFooter({ text: "116 | Ticket Logs" })
      .setTimestamp();

    await logChannel.send({
      embeds: [logEmbed],
      allowedMentions: ticketOwnerId ? { users: [ticketOwnerId] } : { parse: [] },
    });
  }

  // 🕒 Schedule auto-delete in 2 hours
  setTimeout(async () => {
    try {
      await channel.delete();
    } catch (err) {
      console.error("Failed to auto-delete ticket:", err);
    }
  }, 2 * 60 * 60 * 1000);
}

// ── Command Export ──
module.exports = {
  data: new SlashCommandBuilder()
    .setName("completed")
    .setDescription("Mark this ticket as completed, update owed/orders, and log it (Staff only)")
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
      await completeTicketCore({
        client: interaction.client,
        actorUserId: interaction.user.id,
        channel: interaction.channel,
      });

      // ✅ Staff summary reply
      let staffMessage = `✅ Ticket moved and logged. Auto-close scheduled.`;
      if (interaction.user.id !== OWNER_ID) {
        const owedData = await pool.query("SELECT * FROM owed WHERE user_id = $1", [interaction.user.id]);
        const orders = owedData.rows[0]?.orders || 0;
        const total = owedData.rows[0]?.total || 0;
        staffMessage =
          `✅ You have completed **${orders} orders** and owe **$${total}**.\nTicket moved and logged. Auto-close scheduled.`;
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

// --- Bridge trigger entry point (ue-tracker integration) ---
module.exports.runDirect = async (client, { userId, channelId }) => {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) throw new Error("Channel not found for runDirect");

    await completeTicketCore({
      client,
      actorUserId: userId,
      channel,
    });
  } catch (err) {
    console.error("runDirect (bridge) error:", err);
  }
};
