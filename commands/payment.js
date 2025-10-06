// commands/payment.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

/* ENV CONFIG */
const CASHAPP_TAG   = process.env.CASHAPP_TAG   || "$jabed22";
const CASHAPP_LINK  = process.env.CASHAPP_LINK  || "https://cash.app/$jabed22";
const ZELLE_HANDLE  = process.env.ZELLE_HANDLE  || "csharath301@protonmail.com";
const PAYPAL_HANDLE = process.env.PAYPAL_HANDLE || "SDumpali";
const PAYPAL_LINK   = process.env.PAYPAL_LINK   || "https://www.paypal.me/SDumpali";
const APPLE_PAY_INFO = process.env.APPLE_PAY_INFO || "csharath301@icloud.com";
const CRYPTO_TEXT    = process.env.CRYPTO_TEXT    || "DM me for the crypto address!";

/* EMOJIS */
const PAYPAL_EMOJI   = process.env.PAYPAL_EMOJI   || "🅿️";
const ZELLE_EMOJI    = process.env.ZELLE_EMOJI    || "🟣";
const CASHAPP_EMOJI  = process.env.CASHAPP_EMOJI  || "🟢";
const APPLEPAY_EMOJI = process.env.APPLEPAY_EMOJI || "🍎";
const CRYPTO_EMOJI   = process.env.CRYPTO_EMOJI   || "₿";

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

/* BUTTON ROW (PayPal + Cash App) */
function makeButtons(amount) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("PayPal")
      .setURL(buildPayPalLink(PAYPAL_HANDLE, amount)),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Cash App")
      .setURL(buildCashAppLink(CASHAPP_TAG, amount))
  );
}

/* EMBED: main payment details */
function buildPaymentEmbed({ amount, highlight }) {
  const amt = `**$${amount.toFixed(2)}**`;
  const hl = (n) => (n === highlight ? "__**" + n + "**__" : "**" + n + "**");

  const lines = [
    `💰 ${amt} please 😄`,
    "",
    `${PAYPAL_EMOJI} ${hl("PayPal")}: ${PAYPAL_HANDLE} *(FNF only)*`,
    `${ZELLE_EMOJI} ${hl("Zelle")}: ${ZELLE_HANDLE}`,
    `${CASHAPP_EMOJI} ${hl("Cash App")}: ${CASHAPP_TAG}`,
    ...(highlight === "applepay" ? [`${APPLEPAY_EMOJI} ${hl("Apple Pay")}: ${APPLE_PAY_INFO}`] : []),
    `${CRYPTO_EMOJI} ${hl("Crypto")}: ${CRYPTO_TEXT}`,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("💳 Payment Options")
    .setDescription(lines)
    .setFooter({ text: "Payments - Secure and Fast" });
}

/* EMBED: individual method card (private follow-up) */
function buildDirectMethodCard(method, amount) {
  const pretty =
    method === "paypal"   ? "Pay with PayPal"
    : method === "cashapp"  ? "Pay with Cash App"
    : method === "zelle"    ? "Pay with Zelle"
    : method === "applepay" ? "Pay with Apple Pay"
    : method === "crypto"   ? "Pay with Crypto"
    : "Pay Now";

  let url = "";
  if (method === "paypal")  url = buildPayPalLink(PAYPAL_HANDLE, amount);
  if (method === "cashapp") url = buildCashAppLink(CASHAPP_TAG, amount);

  const embed = new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle(`Click Here to ${pretty}`)
    .setDescription(
      url
        ? `Amount: **$${amount.toFixed(2)}**`
        : `Amount: **$${amount.toFixed(2)}**\n\n_No direct link for this method — use the details above._`
    );

  const row = url
    ? new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(pretty).setURL(url)
      )
    : null;

  return { embed, row };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("payment")
    .setDescription("Show payment options (with live buttons)")
    .addStringOption((o) =>
      o
        .setName("method")
        .setDescription("Choose payment method")
        .setRequired(true)
        .addChoices(
          { name: "CashApp", value: "cashapp" },
          { name: "Zelle", value: "zelle" },
          { name: "PayPal", value: "paypal" },
          { name: "Apple Pay", value: "applepay" },
          { name: "Crypto", value: "crypto" }
        )
    )
    .addNumberOption((o) =>
      o
        .setName("amount")
        .setDescription("Amount to pay ($)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const method = interaction.options.getString("method");
    const amount = interaction.options.getNumber("amount");

    if (Number.isNaN(amount) || amount <= 0) {
      return interaction.reply({
        content: "❌ Please provide a valid amount greater than 0.",
        ephemeral: true,
      });
    }

    // 🟩 Main embed (public so others see it)
    const embed = buildPaymentEmbed({ amount, highlight: method });
    const buttons = makeButtons(amount);

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: false, // visible to everyone
    });

    // 🟦 Private follow-up card (for who ran the command)
    const { embed: directEmbed, row } = buildDirectMethodCard(method, amount);
    await interaction.followUp({
      embeds: [directEmbed],
      components: row ? [row] : [],
      ephemeral: true, // visible only to command user
    });
  },
};
