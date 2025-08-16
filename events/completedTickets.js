const { Events } = require("discord.js");
const db = require("../db.js");

module.exports = (client) => {
  const COMPLETED_CATEGORY_ID = process.env.COMPLETED_CATEGORY_ID; // ID of the Completed Tickets category
  const GUILD_ID = process.env.GUILD_ID;

  // Auto-delete every hour
  setInterval(async () => {
    try {
      const now = Date.now();
      const result = await db.query("SELECT ticket_id, completed_at FROM completed_tickets");

      for (const row of result.rows) {
        const msSinceCompleted = now - Number(row.completed_at);
        const isExpired = msSinceCompleted > 2 * 60 * 60 * 1000;

        if (isExpired) {
          try {
            const guild = await client.guilds.fetch(GUILD_ID);
            const channel = guild.channels.cache.get(row.ticket_id) || await guild.channels.fetch(row.ticket_id).catch(() => null);

            if (channel) {
              await channel.send("🗑️ Deleting this completed ticket channel now.");
              await channel.delete("Auto-deleted after 2 hours in completed category");
            }

            await db.query("DELETE FROM completed_tickets WHERE ticket_id = $1", [row.ticket_id]);
            console.log(`✅ Deleted expired ticket: ${row.ticket_id}`);
          } catch (err) {
            console.error(`❌ Failed to delete ticket ${row.ticket_id}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error("❌ Failed to check completed tickets:", err);
    }
  }, 60 * 60 * 1000); // Run every 1 hour

  // Track when a ticket is moved to completed
  client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    if (
      newChannel.type === 0 &&
      oldChannel.parentId !== COMPLETED_CATEGORY_ID &&
      newChannel.parentId === COMPLETED_CATEGORY_ID &&
      newChannel.name.startsWith("ticket-")
    ) {
      await db.query(
        `INSERT INTO completed_tickets (ticket_id, completed_at)
         VALUES ($1, $2)
         ON CONFLICT (ticket_id) DO UPDATE SET completed_at = EXCLUDED.completed_at`,
        [newChannel.id, Date.now()]
      );

      await newChannel.send(
        "✅ This ticket has been marked as completed. This channel will be **automatically deleted in 2 hours**. Thank you!"
      );
    }
  });
};
