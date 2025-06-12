const { Events } = require("discord.js");
const db = require("../db.js");

module.exports = (client) => {
  const COMPLETED_CATEGORY_ID = "1374659946603483136";
  const YOUR_GUILD_ID = "1369186844268433488";

  // Load completed tickets on bot ready
  client.once(Events.ClientReady, async () => {
    const guild = await client.guilds.fetch(YOUR_GUILD_ID);
    const now = Date.now();

    const completedData = await db.query("SELECT ticket_id, completed_at FROM completed_tickets");

    guild.channels.cache.forEach(async (channel) => {
      if (
        channel.parentId === COMPLETED_CATEGORY_ID &&
        channel.name.startsWith("ticket-")
      ) {
        const row = completedData.rows.find((r) => r.ticket_id === channel.id);
        if (row) {
          const msSinceMoved = now - Number(row.completed_at);
          const msLeft = 2.5 * 60 * 60 * 1000 - msSinceMoved;

          const deleteChannel = async () => {
            try {
              await channel.send("🗑️ Deleting this completed ticket channel now.");
              await channel.delete("Auto-deleted after 2.5 hours in completed category");
              await db.query("DELETE FROM completed_tickets WHERE ticket_id = $1", [channel.id]);
            } catch (e) {
              console.error("Auto-delete error:", e);
            }
          };

          if (msLeft <= 0) {
            await deleteChannel();
          } else {
            setTimeout(deleteChannel, msLeft);
          }
        }
      }
    });
  });

  // Track when ticket is moved to completed
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
        "✅ This ticket has been marked as completed. This channel will be **automatically deleted in 2.5 hours**. Thank you!"
      );

      setTimeout(async () => {
        try {
          await newChannel.send("🗑️ Deleting this completed ticket channel now.");
          await newChannel.delete("Auto-deleted after 2.5 hours in completed category");
          await db.query("DELETE FROM completed_tickets WHERE ticket_id = $1", [newChannel.id]);
        } catch (e) {
          console.error("Auto-delete error:", e);
        }
      }, 2.5 * 60 * 60 * 1000);
    }
  });
};
