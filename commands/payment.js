// commands/payment.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Optional: let amounts/handles live in env so you can update without code changes
const CASHAPP_TAG = process.env.CASHAPP_TAG || "$jabed22";
const ZELLE_HANDLE = process.env.ZELLE_HANDLE || "9592401891";
const PAYPAL_HANDLE = process.env.PAYPAL_HANDLE || "9592401891";
const APPLE_PAY_HANDLE = process.env.APPLE_PAY_HANDLE || "csharath301@icloud.com";
const CRYPTO_TEXT = process.env.CRYPTO_TEXT || "DM me for the Crypto address!";

// Owner-role helper
function isServerOwnerOrOwnerRole(interaction) {
  const ownerRoleId = process.env.OWNER_ROLE_ID; // set in Railway
  const isOwner = interaction.user.id === interaction.guild.ownerId;
  const hasOwnerRole = ownerRoleId
    ? interaction.member?.roles?.cache?.has(ownerRoleId)
    : false;
  return isOwner || hasOwnerRole;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("payment")
    .setDescription("Show payment info (Only for you!)")
    .addStringOption((option) =>
      option
        .setName("method")
        .setDescription("Choose payment method")
        .setRequired(true)
        .addChoices(
          { name: "CashApp", value: "cashapp" },
          { name: "Zelle", value: "zelle" },
          { name: "PayPal", value: "paypal" },
          { name: "Apple Pay", value: "applepay" },
          { name: "Crypto", value: "crypto" },
        ),
    )
    .addNumberOption((option) =>
      option
        .setName("amount")
        .setDescription("Amount to pay ($)")
        .setRequired(true),
    ),

  async execute(interaction) {
    // Ensure it’s used in a guild (slash commands usually are, but just in case)
    if (!interaction.inGuild?.() && !interaction.guild) {
      return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    // ✅ Permission: only server owner or members with OWNER_ROLE_ID
    if (!isServerOwnerOrOwnerRole(interaction)) {
      return interaction.reply({
        content: "❌ You are not allowed to use this command.",
        ephemeral: true,
      });
    }

    const method = interaction.options.getString("method");
    const amount = interaction.options.getNumber("amount");

    if (Number.isNaN(amount) || amount <= 0) {
      return interaction.reply({ content: "Please provide a valid amount greater than 0.", ephemeral: true });
    }

    let paymentInfo = "";
    let paymentLabel = "";

    switch (method) {
      case "cashapp":
        paymentLabel = "CashApp Tag";
        paymentInfo = CASHAPP_TAG;
        break;
      case "zelle":
        paymentLabel = "Zelle";
        paymentInfo = ZELLE_HANDLE;
        break;
      case "paypal":
        paymentLabel = "PayPal";
        paymentInfo = PAYPAL_HANDLE;
        break;
      case "applepay":
        paymentLabel = "Apple Pay";
        paymentInfo = APPLE_PAY_HANDLE;
        break;
      case "crypto":
        paymentLabel = "Crypto";
        paymentInfo = CRYPTO_TEXT;
        break;
      default:
        paymentLabel = "Payment";
        paymentInfo = "Invalid payment method!";
    }

    // Nicely emphasized amount line
    const bigAmount =
      `\n\n` +
      "Amount: " +
      `**__ $ ${amount.toFixed(2)} __**\n`;

    const embed = new EmbedBuilder()
      .setTitle("🟩 Payment Information 🟩")
      .setDescription(
        `**${paymentLabel}:**\n` +
        `\`\`\`\n${paymentInfo}\n\`\`\`` +
        `${bigAmount}` +
        `\n**Ping me after payment is done!**`,
      )
      .setColor(0x00d26a)
      .setFooter({ text: "Payments - Secure and Fast" });

    // Make it private to the invoker
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
