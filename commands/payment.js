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

/* YOUR SERVER EMOJI IDS (static) */
const EMOJI = {
  paypal:  { id: "1365389449633988729", name: "paypal",  animated: false },
  zelle:   { id: "1365389471335321600", name: "zelle",   animated: false },
  cashapp: { id: "1391970098050240574", name: "cashapp", animated: false },
  // If you later upload ApplePay/Crypto, add them here and we’ll switch
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
function buildPaymentEmbed({ amount, showApple }) {
  const amt = `**$${amount.toFixed(2)}**`;
  const lines = [
    `💰 ${amt} please 😄`,
    "",
    `<:${EMOJI.paypal.name}:${EMOJI.paypal.id}> **PayPal**: ${PAYPAL_HANDLE} *(FNF only)*`,
    `<:${EMOJI.zelle.name}:${EMOJI.zelle.id}> **Zelle**: ${ZELLE_HANDLE}`,
    `<:${EMOJI.cashapp.name}:${EMOJI.cashapp.id}> **Cash App**: ${CASHAPP_TAG}`,
    ...(showApple ? [`🍎 **Apple Pay**: ${APPLE_PAY_INFO}`] : []),
    `₿ **Crypto**: ${CRYPTO_TEXT}`,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("💳 Payment Options")
    .setDescription(lines)
    .setFooter({ text: "Payments • Secure and Fast" });
}

/* BUTTON ROW (custom emojis on buttons) */
function makeButtons(amount) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Primary)
      .setLabel("PayPal")
      .setEmoji({ id: EMOJI.paypal.id }) // custom emoji by ID
      .setCustomId(`pay:paypal:${amount}`),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Zelle")
      .setEmoji({ id: EMOJI.zelle.id })
      .setCustomId(`pay:zelle:${amount}`),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Success)
      .setLabel("Cash App")
      .setEmoji({ id: EMOJI.cashapp.id })
      .setCustomId(`pay:cashapp:${amount}`),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Apple Pay")
      .setEmoji("🍎") // using unicode (unless you give me an ApplePay emoji ID)
      .setCustomId(`pay:applepay:${amount}`),

    new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setLabel("Crypto")
      .setEmoji("₿") // unicode
      .setCustomId(`pay:crypto:${amount}`)
  );
}

/* PRIVATE FOLLOWUP (after button click) */
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

    if (Number.isNaN(amount) || amount <= 0) {
      return interaction.reply({
        content: "❌ Please provide a valid amount greater than 0.",
        flags: MessageFlags.Ephemeral, // avoid deprecation
      });
    }

    // Public message + buttons
    const embed = buildPaymentEmbed({ amount, showApple: method === "applepay" });
    const buttons = makeButtons(amount);

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      // public message (no ephemeral here)
    });

    // Fetch the sent message the supported way
    const sent = await interaction.fetchReply();

    // Collector for button clicks (10 minutes)
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
        await btn.reply({ ...payload, flags: MessageFlags.Ephemeral }); // avoid deprecation
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
