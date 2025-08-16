// handlers/dmButton.js
const { Events, EmbedBuilder } = require("discord.js");
const { getForChannel } = require("../lib/dmContent");

const COOLDOWN_MS = 3000; // 3s per user per channel
const lastClick = new Map(); // key: `${userId}:${channelId}`

module.exports = (client) => {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    // Accept either new style: dm_request_<channelId>
    // or legacy: dm_info (falls back to the current channel)
    const id = interaction.customId;
    let channelId = null;

    if (id.startsWith("dm_request_")) {
      channelId = id.slice("dm_request_".length);
    } else if (id === "dm_info") {
      channelId = interaction.channelId;
    } else {
      return; // not for us
    }

    // Light rate limit per user per channel
    const key = `${interaction.user.id}:${channelId}`;
    const now = Date.now();
    if ((lastClick.get(key) ?? 0) > now - COOLDOWN_MS) {
      return interaction.reply({ ephemeral: true, content: "⏳ Easy—try again in a moment." });
    }
    lastClick.set(key, now);

    // Fetch the template for that channel
    const tpl = await getForChannel(channelId);
    if (!tpl) {
      return interaction.reply({
        ephemeral: true,
        content: "⚠️ No DM content set for this channel yet. Ask the owner to run `/setdm set` here."
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(tpl.title || "📩 Info")
      .setColor(tpl.color ?? 5793266)
      .setDescription(tpl.body || "No content set.");

    try {
      await interaction.user.send({ embeds: [embed] });
      await interaction.reply({ ephemeral: true, content: "📬 Sent! Check your DMs." });
    } catch {
      await interaction.reply({
        ephemeral: true,
        content: "⚠️ I couldn’t DM you. Enable **Allow DMs from server members** and try again."
      });
    }
  });
};
