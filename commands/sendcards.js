const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const TARGET_CHANNEL_ID = "1405985955994665133"; // where cards go
const ALLOWED_ROLE_ID   = process.env.OWNER_ROLE_ID; // who can use command
const DRIP_DELAY_MS     = 1200;                  // delay between messages
const MAX_RETRIES       = 3;                     // retry attempts per message

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sendcards")
    .setDescription("Send cards one-by-one to the target channel (copy-friendly).")
    .addStringOption((option) =>
      option
        .setName("list")
        .setDescription("Format: card,exp,cvv,zip | card,exp,cvv,zip | ... (pipes or newlines)")
        .setRequired(true)
    )
    // no default perms; we’ll check role manually
    .setDefaultMemberPermissions(0),

  async execute(interaction) {
    try {
      // Permission check: role + channel send perms
      if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
        return interaction.reply({
          content: "❌ You do not have permission to use this command.",
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      // Parse input: support pipes and pasted newlines
      const rawInput = interaction.options.getString("list") || "";
      const normalized = rawInput
        .replace(/\r?\n/g, "|")     // turn newlines into pipes
        .replace(/\s*\|\s*/g, "|")  // trim around pipes
        .trim();

      const cards = normalized
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);

      if (cards.length === 0) {
        return interaction.editReply("⚠️ No valid cards found in your input.");
      }

      // Fetch target channel
      let channel = interaction.client.channels.cache.get(TARGET_CHANNEL_ID);
      if (!channel) {
        try {
          channel = await interaction.client.channels.fetch(TARGET_CHANNEL_ID);
        } catch {
          return interaction.editReply("⚠️ Target channel not found. Check the channel ID.");
        }
      }

      // Quick permission sanity (optional but nice)
      const me = await interaction.guild.members.fetchMe();
      const perms = channel.permissionsFor(me);
      if (!perms?.has(PermissionFlagsBits.SendMessages)) {
        return interaction.editReply("⚠️ I don’t have permission to send messages in the target channel.");
      }

      let sent = 0;

      // Helper: wait
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      // Helper: robust send with retries/backoff
      const sendWithRetry = async (content) => {
        let attempt = 0;
        let lastErr = null;
        while (attempt < MAX_RETRIES) {
          try {
            // Ensure individual message is within Discord 2000-char limit
            if (content.length > 2000) throw new Error("Payload too long for Discord message.");
            await channel.send(content);
            return true;
          } catch (err) {
            lastErr = err;
            attempt += 1;
            // backoff: 1s, 2s, 3s…
            await sleep(1000 * attempt);
          }
        }
        console.error("❌ Failed to send after retries:", lastErr);
        return false;
      };

      for (const card of cards) {
        // code block for easy copy
        const payload = "```" + card + "```";
        const ok = await sendWithRetry(payload);
        if (ok) sent++;

        // drip delay to keep order + avoid 429s
        await sleep(DRIP_DELAY_MS);
      }

      await interaction.editReply(`✅ Sent ${sent}/${cards.length} message(s) to <#${TARGET_CHANNEL_ID}>.`);
    } catch (err) {
      console.error("sendcards error:", err);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply("❌ Something went wrong while sending cards.");
      }
      return interaction.reply({ content: "❌ Something went wrong while sending cards.", ephemeral: true });
    }
  },
};
