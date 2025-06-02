const { Events, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = (client) => {
  const COMPLETED_CATEGORY_ID = "1374659946603483136";
  const YOUR_GUILD_ID = "1369186844268433488";
  const completedTicketsFile = path.join(__dirname, "../completed_tickets.json");

  // Load completed tickets on bot ready
  client.once(Events.ClientReady, async () => {
    let completedData = {};
    try {
      completedData = JSON.parse(fs.readFileSync(completedTicketsFile, "utf-8"));
    } catch {
      completedData = {};
    }

    const guild = await client.guilds.fetch(YOUR_GUILD_ID);
    const now = Date.now();

    guild.channels.cache.forEach(async (channel) => {
      if (
        channel.parentId === COMPLETED_CATEGORY_ID &&
        channel.name.startsWith("ticket-")
      ) {
        const movedAt = completedData[channel.id];
        if (movedAt) {
          const msSinceMoved = now - movedAt;
          const msLeft = 2.5 * 60 * 60 * 1000 - msSinceMoved;
          if (msLeft <= 0) {
            await channel.send("🗑️ Deleting this completed ticket channel now.");
            await channel.delete(
              "Auto-deleted after 2.5 hours in completed category"
            );
          } else {
            setTimeout(async () => {
              try {
                await channel.send("🗑️ Deleting this completed ticket channel now.");
                await channel.delete(
                  "Auto-deleted after 2.5 hours in completed category"
                );
                // Remove from JSON after delete
                let cd = {};
                try {
                  cd = JSON.parse(fs.readFileSync(completedTicketsFile, "utf-8"));
                } catch {
                  cd = {};
                }
                delete cd[channel.id];
                fs.writeFileSync(completedTicketsFile, JSON.stringify(cd, null, 2));
              } catch (e) {}
            }, msLeft);
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
      let completedData = {};
      try {
        completedData = JSON.parse(fs.readFileSync(completedTicketsFile, "utf-8"));
      } catch {
        completedData = {};
      }

      completedData[newChannel.id] = Date.now();
      fs.writeFileSync(completedTicketsFile, JSON.stringify(completedData, null, 2));

      await newChannel.send(
        "✅ This ticket has been marked as completed. This channel will be **automatically deleted in 2.5 hours**. Thank you!"
      );

      setTimeout(async () => {
        try {
          await newChannel.send("🗑️ Deleting this completed ticket channel now.");
          await newChannel.delete(
            "Auto-deleted after 2.5 hours in completed category"
          );
          // Remove from JSON after delete
          let cd = {};
          try {
            cd = JSON.parse(fs.readFileSync(completedTicketsFile, "utf-8"));
          } catch {
            cd = {};
          }
          delete cd[newChannel.id];
          fs.writeFileSync(completedTicketsFile, JSON.stringify(cd, null, 2));
        } catch (e) {}
      }, 2.5 * 60 * 60 * 1000);
    }
  });
};
