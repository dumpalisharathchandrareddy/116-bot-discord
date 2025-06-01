const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

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
    if (interaction.user.id !== "666746569193816086") {
      return interaction.reply({
        content: "You are not allowed to use this command.",
        ephemeral: true,
      });
    }

    const method = interaction.options.getString("method");
    const amount = interaction.options.getNumber("amount");

    let paymentInfo = "";
    let paymentLabel = "";

    switch (method) {
      case "cashapp":
        paymentLabel = "CashApp Tag";
        paymentInfo = "$jabed22";
        break;
      case "zelle":
        paymentLabel = "Zelle";
        paymentInfo = "9592401891";
        break;
      case "paypal":
        paymentLabel = "PayPal";
        paymentInfo = "9592401891";
        break;
      case "crypto":
        paymentLabel = "Crypto";
        paymentInfo = "DM me for the Crypto address!";
        break;
      default:
        paymentLabel = "Payment";
        paymentInfo = "Invalid payment method!";
    }

    // Simulate centering with blank lines and unicode spaces
    // "\u2003" is EM SPACE, "\u3000" is IDEOGRAPHIC SPACE, both wider than normal spaces
    const bigAmount =
      `\n\n\u2003` +
      "Amount: " + // Adjust number for best look
      `**__ $ ${amount.toFixed(2)}__**\n`;

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

    await interaction.reply({ embeds: [embed] });
  },
};
