// commands/setdm.js
const { SlashCommandBuilder } = require("discord.js");
const { setForChannel, getForChannel, resetChannel } = require("../lib/dmContent");

function parseColor(input) {
  if (!input) return undefined;
  if (/^\d+$/.test(input)) return parseInt(input, 10); // decimal int (e.g., 5793266)
  const hex = input.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return undefined; // hex (e.g., #5865F2)
  return parseInt(hex, 16);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setdm")
    .setDescription("Manage DM content for THIS channel (Owner only)")
    .addSubcommand(sc => sc
      .setName("set")
      .setDescription("Create/update DM content for this channel")
      .addStringOption(o => o.setName("body").setDescription("Main DM text. Use \\n for new lines.").setRequired(true))
      .addStringOption(o => o.setName("title").setDescription("Embed title (optional)"))
      .addStringOption(o => o.setName("color").setDescription("Color as int or HEX (e.g., 5793266 or #5865F2)"))
    )
    .addSubcommand(sc => sc
      .setName("preview")
      .setDescription("Preview current DM content for this channel")
    )
    .addSubcommand(sc => sc
      .setName("reset")
      .setDescription("Clear DM content for this channel")
    ),

  async execute(interaction) {
    // ✅ Owner-only permission
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ ephemeral: true, content: "❌ Only the **server owner** can use this command." });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      const title = interaction.options.getString("title") ?? undefined;
      const colorRaw = interaction.options.getString("color") ?? undefined;
      const color = parseColor(colorRaw);
      const body = interaction.options.getString("body").replaceAll("\\n", "\n");

      await setForChannel(interaction.channelId, { title, color, body });
      return interaction.reply({
        ephemeral: true,
        content:
          `✅ Saved for <#${interaction.channelId}>.\n` +
          `**Title:** ${title ?? "📩 Info"}\n` +
          `**Color:** ${color ?? 5793266}\n` +
          `**Preview (first 200):**\n${body.slice(0,200)}${body.length>200?"...":""}`
      });
    }

    if (sub === "preview") {
      const tpl = await getForChannel(interaction.channelId);
      if (!tpl) return interaction.reply({ ephemeral: true, content: "ℹ️ Nothing set for this channel yet." });
      return interaction.reply({
        ephemeral: true,
        content: `**Title:** ${tpl.title}\n**Color:** ${tpl.color}\n**Body:**\n${tpl.body}`
      });
    }

    if (sub === "reset") {
      await resetChannel(interaction.channelId);
      return interaction.reply({ ephemeral: true, content: `🧹 Cleared DM content for <#${interaction.channelId}>.` });
    }
  },
};

// This command allows the server owner to manage DM templates for a specific channel.
// It supports setting, previewing, and resetting the DM content.
// The DM content includes a title, color, and body text, which can be sent to users when they click a DM button.
// The command ensures that only the server owner can execute it,
// and it provides feedback on the actions taken (set, preview, reset).
// The color can be specified as an integer or a hex string, and the body text can include new lines using `\\n`.
// The command also handles parsing the color input and provides a preview of the DM content.
// The DM content is stored in a database table, allowing for easy retrieval and updates.