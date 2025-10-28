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
const VENMO_HANDLE   = process.env.VENMO_HANDLE   || "@sd116";
const VENMO_LINK     = process.env.VENMO_LINK     || "https://venmo.com/u/sd116";
const APPLE_PAY_INFO = process.env.APPLE_PAY_INFO || "csharath301@icloud.com";
const CRYPTO_TEXT    = process.env.CRYPTO_TEXT    || "DM me for the crypto address!";

/* If your emoji are in a specific guild */
const EMOJI_GUILD_ID = process.env.EMOJI_GUILD_ID || process.env.GUILD_ID || null;

/* Your emoji NAMES (exactly as uploaded to your server) */
const EMOJI_NAMES = {
  paypal:   "47266paypal",
  venmo:    "5091venmo",
  zelle:    "7079zelle",
  cashapp:  "5157cashapp",
  applepay: "25515applepay",
  solana:   "19845solana",
};

/* ---------- Helpers ---------- */
function buildCashAppLink(tag, amount) {
  let base = CASHAPP_LINK.replace(/\?.*$/, "").replace(/\/+$/, "");
  return `${base}/${Number(amount).toFixed(0)}`;
}

function buildPayPalLink(handle, amount) {
  let base = PAYPAL_LINK.replace(/\?.*$/, "").replace(/\/+$/, "");
  return `${base}/${Number(amount).toFixed(2)}`;
}

function buildVenmoLink(handle, amount) {
  return `${VENMO_LINK}?txn=pay&amount=${Number(amount).toFixed(2)}`;
}

/** Resolve emoji IDs by name */
async function resolveEmojiId(interaction, name) {
  const client = interaction.client;
  const tried = new Set();

  async function tryGuild(guildId) {
    if (!guildId || tried.has(guildId)) return null;
    tried.add(guildId);
    const g = await client.guilds.fetch(guildId).catch(() => null);
    if (!g) return null;
    await g.emojis.fetch().catch(() => {});
    return g.emojis.cache.find((e) => e.name === name)?.id || null;
  }

  const cur = interaction.guild?.id || null;
  const id1 = await tryGuild(cur); if (id1) return id1;
  const id2 = await tryGuild(EMOJI_GUILD_ID); if (id2) return id2;
  const id3 = await tryGuild(process.env.GUILD_ID); if (id3) return id3;
  return null;
}

async function getEmojiIds(interaction) {
  const ids = {};
  for (const [k, name] of Object.entries(EMOJI_NAMES)) {
    ids[k] = await resolveEmojiId(interaction, name);
  }
  return ids;
}

/* ---------- Embed Layout ---------- */
function makePublicEmbed({ amount, emojiIds, appleEnabled }) {
  const amt = `**💰 $${amount.toFixed(2)} please 😄**`;

  const paypalLine =
    emojiIds.paypal ? `<:${EMOJI_NAMES.paypal}:${emojiIds.paypal}> **PayPal:** ${PAYPAL_HANDLE} *(FNF)*`
                    : `🅿️ **PayPal:** ${PAYPAL_HANDLE} *(FNF)*`;

  const venmoLine =
    emojiIds.venmo ? `<:${EMOJI_NAMES.venmo}:${emojiIds.venmo}> **Venmo:** ${VENMO_HANDLE} *(Purchase Protection OFF)*`
                   : `🔵 **Venmo:** ${VENMO_HANDLE} *(Purchase Protection OFF)*`;

  const zelleLine =
    emojiIds.zelle ? `<:${EMOJI_NAMES.zelle}:${emojiIds.zelle}> **Zelle:** ${ZELLE_HANDLE}`
                   : `💜 **Zelle:** ${ZELLE_HANDLE}`;

  const cashLine =
    emojiIds.cashapp ? `<:${EMOJI_NAMES.cashapp}:${emojiIds.cashapp}> **Cash App:** ${CASHAPP_TAG}`
                     : `🟢 **Cash App:** ${CASHAPP_TAG}`;

  const appleLine = appleEnabled
    ? (emojiIds.applepay
        ? `<:${EMOJI_NAMES.applepay}:${emojiIds.applepay}> **Apple Pay:** ${APPLE_PAY_INFO}`
        : `🍎 **Apple Pay:** ${APPLE_PAY_INFO}`)
    : "🍎 **Apple Pay:** *Unavailable this round*";

  const cryptoLine =
    emojiIds.solana ? `<:${EMOJI_NAMES.solana}:${emojiIds.solana}> **Crypto:** ${CRYPTO_TEXT}`
                    : `🪙 **Crypto:** ${CRYPTO_TEXT}`;

  const desc = [
    amt,
    "",
    paypalLine,
    venmoLine,
    zelleLine,
    cashLine,
    appleLine,
    cryptoLine,
    "",
    "**PLEASE SEND A SS OF PAYMENT CONFIRMATION**",
  ].join("\n");

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setDescription(desc)
    .setFooter({ text: "Payments • Secure and Fast" });
}

/* ---------- Buttons ---------- */
function makeButtons(amount, emojiIds, appleEnabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Primary)
      .setLabel("PayPal")
      .setCustomId(`pay:paypal:${amount}`)
      .setEmoji(emojiIds.paypal ? { id: emojiIds.paypal } : "🅿️"),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Primary)
      .setLabel("Venmo")
      .setCustomId(`pay:venmo:${amount}`)
      .setEmoji(emojiIds.venmo ? { id: emojiIds.venmo } : "🔵"),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Zelle")
      .setCustomId(`pay:zelle:${amount}`)
      .setEmoji(emojiIds.zelle ? { id: emojiIds.zelle } : "💜"),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Success)
      .setLabel("Cash App")
      .setCustomId(`pay:cashapp:${amount}`)
      .setEmoji(emojiIds.cashapp ? { id: emojiIds.cashapp } : "🟢"),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Apple Pay")
      .setCustomId(`pay:applepay:${amount}`)
      .setEmoji(emojiIds.applepay ? { id: emojiIds.applepay } : "🍎")
      .setDisabled(!appleEnabled),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setLabel("Crypto")
      .setCustomId(`pay:crypto:${amount}`)
      .setEmoji(emojiIds.solana ? { id: emojiIds.solana } : "🪙"),
  );
}

/* ---------- Follow-Up Embeds ---------- */
function buildFollowup(method, amount) {
  const amt = `**$${Number(amount).toFixed(2)}**`;
  const colorMap = {
    paypal:  0x0079c1,
    venmo:   0x3d95ce,
    zelle:   0x6a1b9a,
    cashapp: 0x00c244,
    applepay:0x000000,
    crypto:  0xf7931a,
  };
  const titleMap = {
    paypal:  "Pay with PayPal",
    venmo:   "Pay with Venmo",
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
        ? `**PayPal:** ${PAYPAL_HANDLE}\n[Open PayPal](${buildPayPalLink(PAYPAL_HANDLE, Number(amount))})`
        : method === "venmo"
        ? `**Venmo:** ${VENMO_HANDLE}\n[Open Venmo](${buildVenmoLink(VENMO_HANDLE, Number(amount))})`
        : method === "zelle"
        ? `**Zelle:** ${ZELLE_HANDLE}\n_Pay via your banking app_`
        : method === "cashapp"
        ? `**Cash App:** ${CASHAPP_TAG}\n[Open Cash App](${buildCashAppLink(CASHAPP_TAG, Number(amount))})`
        : method === "applepay"
        ? `**Apple Pay:** ${APPLE_PAY_INFO}\n_Send via Apple Cash_`
        : `**Crypto:** ${CRYPTO_TEXT}`,
      "",
      "**PLEASE SEND A SS OF PAYMENT CONFIRMATION**",
    ].join("\n"));

  return { embeds: [embed] };
}

/* ---------- Slash Command ---------- */
module.exports = {
  data: new SlashCommandBuilder()
    .setName("payment")
    .setDescription("Show payment options (with emoji buttons)")
    .addNumberOption((o) =>
      o.setName("amount").setDescription("Amount to pay ($)").setRequired(true)
    )
    .addBooleanOption((o) =>
      o.setName("applepay")
        .setDescription("Enable Apple Pay for this session?")
        .setRequired(false)
    ),

  async execute(interaction) {
    const amount = interaction.options.getNumber("amount");
    const appleEnabled = interaction.options.getBoolean("applepay") ?? false;

    if (Number.isNaN(amount) || amount <= 0) {
      return interaction.reply({
        content: "❌ Please provide a valid amount greater than 0.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const emojiIds = await getEmojiIds(interaction);
    const embed = makePublicEmbed({ amount, emojiIds, appleEnabled });
    const buttons = makeButtons(amount, emojiIds, appleEnabled);

    await interaction.reply({ embeds: [embed], components: [buttons] });
    const sent = await interaction.fetchReply();

    const filter = (i) => i.customId?.startsWith("pay:") && i.message.id === sent.id;
    const collector = sent.createMessageComponentCollector({
      filter,
      componentType: ComponentType.Button,
      time: 10 * 60 * 1000,
    });

    collector.on("collect", async (btn) => {
      const [, method, amt] = btn.customId.split(":");
      const payload = buildFollowup(method, amt);
      await btn.reply({ ...payload, flags: MessageFlags.Ephemeral });
    });

    collector.on("end", async () => {
      const disabled = new ActionRowBuilder().addComponents(
        buttons.components.map((b) => ButtonBuilder.from(b).setDisabled(true))
      );
      await sent.edit({ components: [disabled] }).catch(() => {});
    });
  },
};
