// commands/payment.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

/* ENV CONFIG */
const CASHAPP_TAG    = process.env.CASHAPP_TAG    || "$jabed22";
const CASHAPP_LINK   = process.env.CASHAPP_LINK   || "https://cash.app/$jabed22";
const ZELLE_HANDLE   = process.env.ZELLE_HANDLE   || "csharath301@protonmail.com";
const PAYPAL_HANDLE  = process.env.PAYPAL_HANDLE  || "SDumpali";
const PAYPAL_LINK    = process.env.PAYPAL_LINK    || "https://www.paypal.me/SDumpali";
const APPLE_PAY_INFO = process.env.APPLE_PAY_INFO || "csharath301@icloud.com";
const CRYPTO_TEXT    = process.env.CRYPTO_TEXT    || "DM me for the crypto address!";

/* STATIC LOGO ICONS (uniform sizing) */
const ICONS = {
  paypal:   "https://cdn3.emoji.gg/emojis/1716_PAYPAL.png",
  zelle:    "https://cdn3.emoji.gg/emojis/7079-zelle.png",
  cashapp:  "https://cdn3.emoji.gg/emojis/6329-cashapp.png",
  applepay: "https://cdn3.emoji.gg/emojis/25515-applepay.png",
  crypto:   "https://cdn3.emoji.gg/emojis/4887-ltc.png",
};

/* URL BUILDERS */
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

/* MAIN EMBED (public) */
function buildPaymentEmbed({ amount, highlight }) {
  const amt = `**$${amount.toFixed(2)}**`;
  const hl = (n) => (n === highlight ? "__**" + n + "**__" : "**" + n + "**");

  const lines = [
    `💰 ${amt} please 😄`,
    "",
    `🅿️ ${hl("PayPal")}: ${PAYPAL_HANDLE} *(FNF only)*`,
    `🟣 ${hl("Zelle")}: ${ZELLE_HANDLE}`,
    `🟢 ${hl("Cash App")}: ${CASHAPP_TAG}`,
    ...(highlight === "applepay" ? [`🍎 ${hl("Apple Pay")}: ${APPLE_PAY_INFO}`] : []),
    `₿ ${hl("Crypto")}: ${CRYPTO_TEXT}`,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("💳 Payment Options")
    .setDescription(lines)
    .setFooter({ text: "Payments - Secure and Fast" });
}

/* BUTTON ROW (logo + color) */
function makeButtons(amount) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Primary)
      .setLabel("PayPal")
      .setEmoji({ name: "paypal", id: null, url: ICONS.paypal }) // shows image logo
      .setCustomId(`pay:paypal:${amount}`),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Zelle")
      .setEmoji({ name: "zelle", id: null, url: ICONS.zelle })
      .setCustomId(`pay:zelle:${amount}`),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Success)
      .setLabel("Cash App")
      .setEmoji({ name: "cashapp", id: null, url: ICONS.cashapp })
      .setCustomId(`pay:cashapp:${amount}`),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Apple Pay")
      .setEmoji({ name: "applepay", id: null, url: ICONS.applepay })
      .setCustomId(`pay:applepay:${amount}`),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setLabel("Crypto")
      .setEmoji({ name: "crypto", id: null, url: ICONS.crypto })
      .setCustomId(`pay:crypto:${amount}`)
  );
}

/* PRIVATE FOLLOWUP (after button click) */
function buildFollowup(method, amount) {
  const amt = `**$${Number(amount).toFixed(2)}**`;
  const colorMap = {
    paypal: 0x0079c1,
    zelle:  0x6a1b9a,
    cashapp:0x00c244,
    applepay:0x000000,
    crypto: 0xf7931a,
  };
  const titleMap = {
    paypal: "Pay with PayPal",
    zelle: "Zelle Payment",
    cashapp: "Pay with Cash App",
    applepay: "Apple Pay",
    crypto: "Crypto Payment",
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
        ? `**PayPal:** ${PAYPAL_HANDLE}\n[FNF Only](${buildPayPalLink(PAYPAL_HANDLE, Number(amount))})`
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("payment")
    .setDescription("Show payment options (with live logo buttons)")

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
    if (Number.isNaN(amount) || amount <= 0)
      return interaction.reply({ content: "❌ Invalid amount.", ephemeral: true });

    const embed = buildPaymentEmbed({ amount, highlight: method });
    const buttons = makeButtons(amount);
    const sent = await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: false,
      fetchReply: true,
    });

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
