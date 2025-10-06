// commands/payment.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

/* ───────────────── ENV CONFIG ───────────────── */
const CASHAPP_TAG    = process.env.CASHAPP_TAG    || "$jabed22";
const CASHAPP_LINK   = process.env.CASHAPP_LINK   || "https://cash.app/$jabed22";
const ZELLE_HANDLE   = process.env.ZELLE_HANDLE   || "csharath301@protonmail.com";
const PAYPAL_HANDLE  = process.env.PAYPAL_HANDLE  || "SDumpali";
const PAYPAL_LINK    = process.env.PAYPAL_LINK    || "https://www.paypal.me/SDumpali";
const APPLE_PAY_INFO = process.env.APPLE_PAY_INFO || "csharath301@icloud.com";
const CRYPTO_TEXT    = process.env.CRYPTO_TEXT    || "DM me for the crypto address!";

/* ─────────────── CUSTOM EMOJI IDS (your uploaded ones) ─────────────── */
const EMOJI_PP_ID   = "472669441024581633";  // <:47266paypal:472669441024581633>
const EMOJI_ZEL_ID  = "707924857915817000";  // <:7079zelle:707924857915817000>
const EMOJI_CASH_ID = "515792469616607244";  // <:5157cashapp:515792469616607244>
const EMOJI_APP_ID  = "255151364146716672";  // <:25515applepay:255151364146716672>
const EMOJI_CRY_ID  = "198457986375925760";  // <:19845solana:198457986375925760>

/* ─────────────── ICONS (for embeds only) ─────────────── */
const ICONS = {
  paypal:   "https://cdn3.emoji.gg/emojis/1716_PAYPAL.png",
  zelle:    "https://cdn3.emoji.gg/emojis/7079-zelle.png",
  cashapp:  "https://cdn3.emoji.gg/emojis/6329-cashapp.png",
  applepay: "https://cdn3.emoji.gg/emojis/25515-applepay.png",
  crypto:   "https://cdn3.emoji.gg/emojis/4887-ltc.png",
};

/* ─────────────── URL BUILDERS ─────────────── */
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

/* ─────────────── MAIN EMBED (public) ─────────────── */
function buildPaymentEmbed({ amount, highlight }) {
  const amt = `**$${amount.toFixed(2)}**`;
  const hl = (n) => (n === highlight ? "__**" + n + "**__" : "**" + n + "**");

  const lines = [
    `💰 ${amt} please 😄`,
    "",
    `<:47266paypal:${EMOJI_PP_ID}> ${hl("PayPal")}: ${PAYPAL_HANDLE} *(FNF only)*`,
    `<:7079zelle:${EMOJI_ZEL_ID}> ${hl("Zelle")}: ${ZELLE_HANDLE}`,
    `<:5157cashapp:${EMOJI_CASH_ID}> ${hl("Cash App")}: ${CASHAPP_TAG}`,
    ...(highlight === "applepay"
      ? [`<:25515applepay:${EMOJI_APP_ID}> ${hl("Apple Pay")}: ${APPLE_PAY_INFO}`]
      : []),
    `<:19845solana:${EMOJI_CRY_ID}> ${hl("Crypto")}: ${CRYPTO_TEXT}`,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("💳 Payment Options")
    .setDescription(lines)
    .setFooter({ text: "Payments • Secure and Fast" });
}

/* ─────────────── BUTTON ROW ─────────────── */
function makeButtons(amount) {
  const paypalBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("PayPal")
    .setEmoji(EMOJI_PP_ID)
    .setURL(buildPayPalLink(PAYPAL_HANDLE, amount));

  const cashBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Cash App")
    .setEmoji(EMOJI_CASH_ID)
    .setURL(buildCashAppLink(CASHAPP_TAG, amount));

  const zelleBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Primary)
    .setLabel("Zelle")
    .setEmoji(EMOJI_ZEL_ID)
    .setCustomId(`pay:zelle:${amount}`);

  const appleBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel("Apple Pay")
    .setEmoji(EMOJI_APP_ID)
    .setCustomId(`pay:applepay:${amount}`);

  const cryptoBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel("Crypto")
    .setEmoji(EMOJI_CRY_ID)
    .setCustomId(`pay:crypto:${amount}`);

  return new ActionRowBuilder().addComponents(
    paypalBtn, cashBtn, zelleBtn, appleBtn, cryptoBtn
  );
}

/* ─────────────── PRIVATE FOLLOW-UP (after click) ─────────────── */
function buildFollowup(method, amount) {
  const amt = `**$${Number(amount).toFixed(2)}**`;
  const colorMap = {
    paypal:  0x0079c1,
    zelle:   0x6a1b9a,
    cashapp: 0x00c244,
    applepay:0x0f0f0f,
    crypto:  0xf7931a,
  };
  const titleMap = {
    paypal:  "Pay with PayPal",
    zelle:   "Zelle Payment",
    cashapp: "Pay with Cash App",
    applepay:"Apple Pay",
    crypto:  "Crypto Payment",
  };

  const icon = ICONS[method];
  const embed = new EmbedBuilder()
    .setColor(colorMap[method] || 0x22c55e)
    .setTitle(titleMap[method])
    .setThumbnail(icon)
    .setDescription([
      `Amount: ${amt}`,
      "",
      method === "paypal"
        ? `**PayPal:** ${PAYPAL_HANDLE}\n[Open PayPal (FNF)](${buildPayPalLink(PAYPAL_HANDLE, Number(amount))})`
        : method === "zelle"
        ? `**Zelle:**\n# ${ZELLE_HANDLE}\n\n_Pay through your banking app_`
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

/* ─────────────── SLASH COMMAND ─────────────── */
module.exports = {
  data: new SlashCommandBuilder()
    .setName("payment")
    .setDescription("Show payment options (with logo buttons)")
    .addNumberOption((o) =>
      o.setName("amount").setDescription("Amount to pay ($)").setRequired(true)
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
      return interaction.reply({ content: "❌ Invalid amount.", ephemeral: true });
    }

    // Public embed with buttons
    const embed = buildPaymentEmbed({ amount, highlight: method });
    const buttons = makeButtons(amount);
    const sent = await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: false,
      fetchReply: true,
    });

    // Button click → private follow-up
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
        await btn.reply({ ...payload, ephemeral: true });
      } catch {
        await btn.reply({ content: "❌ Could not open payment details.", ephemeral: true });
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
