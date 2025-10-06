// commands/payment.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");

/* ENV CONFIG */
const CASHAPP_TAG    = process.env.CASHAPP_TAG    || "$jabed22";
const CASHAPP_LINK   = process.env.CASHAPP_LINK   || "https://cash.app/$jabed22";
const ZELLE_HANDLE   = process.env.ZELLE_HANDLE   || "csharath301@protonmail.com";
const PAYPAL_HANDLE  = process.env.PAYPAL_HANDLE  || "SDumpali";
const PAYPAL_LINK    = process.env.PAYPAL_LINK    || "https://www.paypal.me/SDumpali";
const APPLE_PAY_INFO = process.env.APPLE_PAY_INFO || "csharath301@icloud.com";
const CRYPTO_TEXT    = process.env.CRYPTO_TEXT    || "DM me for the crypto address!";

/* If your emoji are in a specific guild, put it here (falls back to GUILD_ID, then current guild) */
const EMOJI_GUILD_ID = process.env.EMOJI_GUILD_ID || process.env.GUILD_ID || null;

/* Your emoji NAMES (exactly as in the server) */
const EMOJI_NAMES = {
  paypal:   "47266paypal",
  zelle:    "7079zelle",
  cashapp:  "5157cashapp",
  applepay: "25515applepay",
  solana:   "19845solana", // using Solana for Crypto
};

/* -------- Helpers -------- */
function appendAmount(url, amount) {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("amount")) u.searchParams.set("amount", amount.toFixed(2));
    return u.toString();
  } catch {
    return url;
  }
}
function buildCashAppLink(tag, amount) {
  if (CASHAPP_LINK) return appendAmount(CASHAPP_LINK, amount);
  return `https://cash.app/${encodeURIComponent(tag.replace(/^\$/, "$"))}`;
}
function buildPayPalLink(handle, amount) {
  if (PAYPAL_LINK) return appendAmount(PAYPAL_LINK, amount);
  if (/^[a-z0-9_.-]+$/i.test(handle)) {
    return `https://www.paypal.me/${encodeURIComponent(handle)}/${amount.toFixed(2)}`;
  }
  return "https://www.paypal.me/";
}

/** Resolve one emoji ID by name from: current guild → EMOJI_GUILD_ID → GUILD_ID fallback */
async function resolveEmojiId(interaction, name) {
  const client = interaction.client;
  const triedGuildIds = new Set();

  async function tryGuild(guildId) {
    if (!guildId || triedGuildIds.has(guildId)) return null;
    triedGuildIds.add(guildId);
    const g = await client.guilds.fetch(guildId).catch(() => null);
    if (!g) return null;
    await g.emojis.fetch().catch(() => {});
    const e = g.emojis.cache.find((x) => x.name === name);
    return e?.id || null;
  }

  // 1) current guild (if any)
  const curId = interaction.guild?.id || null;
  if (curId) {
    const id = await tryGuild(curId);
    if (id) return id;
  }
  // 2) explicit emoji guild
  if (EMOJI_GUILD_ID) {
    const id = await tryGuild(EMOJI_GUILD_ID);
    if (id) return id;
  }
  // 3) fallback to configured GUILD_ID (if different)
  const fallbackId = process.env.GUILD_ID || null;
  if (fallbackId && fallbackId !== EMOJI_GUILD_ID && fallbackId !== curId) {
    const id = await tryGuild(fallbackId);
    if (id) return id;
  }
  return null;
}

/** Resolve all emoji IDs we need in one go */
async function getEmojiIds(interaction) {
  const ids = {};
  for (const [k, name] of Object.entries(EMOJI_NAMES)) {
    ids[k] = await resolveEmojiId(interaction, name);
  }
  return ids;
}

/* -------- Embeds & UI -------- */
function makePublicEmbed({ amount, showApple, emojiIds }) {
  const amt = `**$${amount.toFixed(2)}**`;

  const paypalLine =
    emojiIds.paypal ? `<:${EMOJI_NAMES.paypal}:${emojiIds.paypal}> **PayPal**: ${PAYPAL_HANDLE} *(FNF only)*`
                    : `🅿️ **PayPal**: ${PAYPAL_HANDLE} *(FNF only)*`;

  const zelleLine =
    emojiIds.zelle ? `<:${EMOJI_NAMES.zelle}:${emojiIds.zelle}> **Zelle**: ${ZELLE_HANDLE}`
                   : `🟣 **Zelle**: ${ZELLE_HANDLE}`;

  const cashLine =
    emojiIds.cashapp ? `<:${EMOJI_NAMES.cashapp}:${emojiIds.cashapp}> **Cash App**: ${CASHAPP_TAG}`
                     : `🟢 **Cash App**: ${CASHAPP_TAG}`;

  const appleInline = showApple
    ? (emojiIds.applepay
        ? `<:${EMOJI_NAMES.applepay}:${emojiIds.applepay}> **Apple Pay**: ${APPLE_PAY_INFO}`
        : `🍎 **Apple Pay**: ${APPLE_PAY_INFO}`)
    : null;

  const cryptoLine =
    emojiIds.solana ? `<:${EMOJI_NAMES.solana}:${emojiIds.solana}> **Crypto**: ${CRYPTO_TEXT}`
                    : `🪙 **Crypto**: ${CRYPTO_TEXT}`;

  const lines = [
    `💰 ${amt} please 😄`,
    "",
    paypalLine,
    zelleLine,
    cashLine,
    ...(appleInline ? [appleInline] : []),
    cryptoLine,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("💳 Payment Options")
    .setDescription(lines)
    .setFooter({ text: "Payments • Secure and Fast" });
}

function makeButtons(amount, emojiIds) {
  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Primary)
      .setLabel("PayPal")
      .setCustomId(`pay:paypal:${amount}`)
      .setEmoji(emojiIds.paypal ? { id: emojiIds.paypal } : "🅿️"),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Zelle")
      .setCustomId(`pay:zelle:${amount}`)
      .setEmoji(emojiIds.zelle ? { id: emojiIds.zelle } : "🟣"),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Success)
      .setLabel("Cash App")
      .setCustomId(`pay:cashapp:${amount}`)
      .setEmoji(emojiIds.cashapp ? { id: emojiIds.cashapp } : "🟢"),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Apple Pay")
      .setCustomId(`pay:applepay:${amount}`)
      .setEmoji(emojiIds.applepay ? { id: emojiIds.applepay } : "🍎"),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setLabel("Crypto")
      .setCustomId(`pay:crypto:${amount}`)
      .setEmoji(emojiIds.solana ? { id: emojiIds.solana } : "🪙"),
  );

  return row;
}

function buildFollowup(method, amount) {
  const amt = `**$${Number(amount).toFixed(2)}**`;
  const colorMap = {
    paypal:  0x0079c1,
    zelle:   0x6a1b9a,
    cashapp: 0x00c244,
    applepay:0x000000,
    crypto:  0xf7931a,
  };
  const titleMap = {
    paypal:  "Pay with PayPal",
    zelle:   "Zelle Payment",
    cashapp: "Pay with Cash App",
    applepay:"Apple Pay",
    crypto:  "Crypto Payment",
  };

  const embed = new EmbedBuilder()
    .setColor(colorMap[method] || 0x22c55e)
    .setTitle(titleMap[method])
    .setDescription([
      `Amount: ${amt}`,
      "",
      method === "paypal"
        ? `**PayPal:** ${PAYPAL_HANDLE}\n[FNF Only](${buildPayPalLink(PAYPAL_HANDLE, Number(amount))})`
        : method === "zelle"
        ? `**Zelle:**\n# ${ZELLE_HANDLE}\n\n_Pay via your banking app_`
        : method === "cashapp"
        ? `**Cash App:** ${CASHAPP_TAG}\n[Open Cash App](${buildCashAppLink(CASHAPP_TAG, Number(amount))})`
        : method === "applepay"
        ? `**Apple Pay:** ${APPLE_PAY_INFO}\n_Send via Apple Cash_`
        : `**Crypto:** ${CRYPTO_TEXT}`,
    ].join("\n"));

  const row =
    method === "paypal"
      ? new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Open PayPal")
            .setURL(buildPayPalLink(PAYPAL_HANDLE, Number(amount)))
        )
      : method === "cashapp"
      ? new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Open Cash App")
            .setURL(buildCashAppLink(CASHAPP_TAG, Number(amount)))
        )
      : null;

  return { embeds: [embed], components: row ? [row] : [] };
}

/* -------- Slash Command -------- */
module.exports = {
  data: new SlashCommandBuilder()
    .setName("payment")
    .setDescription("Show payment options (with logo buttons)")
    .addNumberOption((o) =>
      o
        .setName("amount")
        .setDescription("Amount to pay ($)")
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("method")
        .setDescription("Optional: select Apple Pay to show it inline")
        .setRequired(false)
        .addChoices({ name: "Apple Pay", value: "applepay" })
    ),

  async execute(interaction) {
    const method = interaction.options.getString("method") || null;
    const amount = interaction.options.getNumber("amount");

    if (Number.isNaN(amount) || amount <= 0) {
      return interaction.reply({
        content: "❌ Please provide a valid amount greater than 0.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Resolve emoji IDs by name (works across servers/DMs if the bot can see that guild)
    const emojiIds = await getEmojiIds(interaction);

    // Public message + buttons
    const embed = makePublicEmbed({ amount, showApple: method === "applepay", emojiIds });
    const buttons = makeButtons(amount, emojiIds);

    await interaction.reply({ embeds: [embed], components: [buttons] });
    const sent = await interaction.fetchReply();

    // Collector (10 min)
    const filter = (i) => i.customId?.startsWith("pay:") && i.message.id === sent.id;
    const collector = sent.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
      time: 10 * 60 * 1000,
    });

    collector.on("collect", async (btn) => {
      try {
        const [, methodClicked, amountClicked] = btn.customId.split(":");
        const payload = buildFollowup(methodClicked, amountClicked);
        await btn.reply({ ...payload, flags: MessageFlags.Ephemeral });
      } catch {
        await btn.reply({ content: "❌ Could not open payment details.", flags: MessageFlags.Ephemeral });
      }
    });

    collector.on("end", async () => {
      const disabled = new ActionRowBuilder().addComponents(
        buttons.components.map((b) => ButtonBuilder.from(b).setDisabled(true))
      );
      await sent.edit({ components: [disabled] }).catch(() => {});
    });
  },
};
