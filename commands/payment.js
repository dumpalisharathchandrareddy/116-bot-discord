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

/* ---------- Helper functions ---------- */
function buildCashAppLink(tag, amount) {
  let base = CASHAPP_LINK.replace(/\?.*$/, "").replace(/\/+$/, "");
  return `${base}/${Number(amount).toFixed(0)}`;
}
function buildPayPalLink(handle, amount) {
  let base = PAYPAL_LINK.replace(/\?.*$/, "").replace(/\/+$/, "");
  return `${base}/${Number(amount).toFixed(2)}`;
}

/* ---------- Embed Builders ---------- */
function makePublicEmbed({ amount, appleEnabled }) {
  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("💳 Payment Options")
    .setDescription(
      [
        `💰 **$${amount.toFixed(2)}** please 😄`,
        "",
        `🅿️ **PayPal:** ${PAYPAL_HANDLE} *(FNF only)*`,
        `🟣 **Zelle:** ${ZELLE_HANDLE}`,
        `🟢 **Cash App:** ${CASHAPP_TAG}`,
        `🍎 **Apple Pay:** ${appleEnabled ? APPLE_PAY_INFO : "Unavailable this round"}`,
        `🪙 **Crypto:** ${CRYPTO_TEXT}`,
        "",
        "🧾 **Please send a screenshot once payment is sent!**",
      ].join("\n")
    )
    .setFooter({ text: "Payments • Secure and Fast" });
}

function makeButtons(amount, appleEnabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("PayPal")
      .setEmoji("🅿️")
      .setStyle(ButtonStyle.Primary)
      .setCustomId(`pay:paypal:${amount}`),
    new ButtonBuilder()
      .setLabel("Zelle")
      .setEmoji("🟣")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`pay:zelle:${amount}`),
    new ButtonBuilder()
      .setLabel("Cash App")
      .setEmoji("🟢")
      .setStyle(ButtonStyle.Success)
      .setCustomId(`pay:cashapp:${amount}`),
    new ButtonBuilder()
      .setLabel("Apple Pay")
      .setEmoji("🍎")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`pay:applepay:${amount}`)
      .setDisabled(!appleEnabled),
    new ButtonBuilder()
      .setLabel("Crypto")
      .setEmoji("🪙")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`pay:crypto:${amount}`)
  );
}

function buildFollowup(method, amount) {
  const amt = `**$${Number(amount).toFixed(2)}**`;
  const map = {
    paypal:  { color: 0x0079c1, title: "Pay with PayPal", body: `**PayPal:** ${PAYPAL_HANDLE}\n[Open PayPal](${buildPayPalLink(PAYPAL_HANDLE, amount)})` },
    zelle:   { color: 0x6a1b9a, title: "Zelle Payment", body: `**Zelle:** ${ZELLE_HANDLE}\n_Pay via your banking app_` },
    cashapp: { color: 0x00c244, title: "Pay with Cash App", body: `**Cash App:** ${CASHAPP_TAG}\n[Open Cash App](${buildCashAppLink(CASHAPP_TAG, amount)})` },
    applepay:{ color: 0x000000, title: "Apple Pay", body: `**Apple Pay:** ${APPLE_PAY_INFO}\n_Send via Apple Cash_` },
    crypto:  { color: 0xf7931a, title: "Crypto Payment", body: `**Crypto:** ${CRYPTO_TEXT}` },
  };

  const info = map[method];
  const embed = new EmbedBuilder()
    .setColor(info.color)
    .setTitle(info.title)
    .setDescription(`${info.body}\n\n🧾 **# Please send a screenshot once payment is sent!**`)
    .setFooter({ text: "Payments • Secure and Fast" });

  return { embeds: [embed] };
}

/* ---------- Command ---------- */
module.exports = {
  data: new SlashCommandBuilder()
    .setName("payment")
    .setDescription("Show payment options (with logo buttons)")
    .addNumberOption(o =>
      o.setName("amount")
       .setDescription("Amount to pay ($)")
       .setRequired(true))
    .addBooleanOption(o =>
      o.setName("applepay")
       .setDescription("Enable Apple Pay option?")
       .setRequired(false)),

  async execute(interaction) {
    const amount = interaction.options.getNumber("amount");
    const appleEnabled = interaction.options.getBoolean("applepay") ?? false;

    if (Number.isNaN(amount) || amount <= 0) {
      return interaction.reply({
        content: "❌ Please provide a valid amount greater than 0.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = makePublicEmbed({ amount, appleEnabled });
    const buttons = makeButtons(amount, appleEnabled);

    await interaction.reply({ embeds: [embed], components: [buttons] });
    const sent = await interaction.fetchReply();

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 10 * 60 * 1000,
      filter: (i) => i.customId?.startsWith("pay:") && i.message.id === sent.id,
    });

    collector.on("collect", async (btn) => {
      const [, method, amt] = btn.customId.split(":");
      const payload = buildFollowup(method, amt);
      await btn.reply({ ...payload, flags: MessageFlags.Ephemeral });
    });

    collector.on("end", async () => {
      const disabled = new ActionRowBuilder().addComponents(
        buttons.components.map(b => ButtonBuilder.from(b).setDisabled(true))
      );
      await sent.edit({ components: [disabled] }).catch(() => {});
    });
  },
};
