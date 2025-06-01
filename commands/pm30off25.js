const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pm30off35")
    .setDescription("Get Postmates $30 off $35+ promo link!"),
  async execute(interaction) {
    const embed = new EmbedBuilder().setDescription(
      "PM 30 off 35: [Click Here](https://postmates.com/marketing?mft=TARGETING_STORE_PROMO&pl=JTdCJTIyYWRkcmVzcyUyMiUzQSUyMjExNiUyME1vcm5pbmdzaWRlJTIwU3QlMjBXJTIyJTJDJTIycmVmZXJlbmNlJTIyJTNBJTIyM2NmY2Y1NjUtOWY2NS03ZTkwLTVkOTItYWVkNjU2NmYzNjRhJTIyJTJDJTIycmVmZXJlbmNlVHlwZSUyMiUzQSUyMnViZXJfcGxhY2VzJTIyJTJDJTIybGF0aXR1ZGUlMjIlM0E0MS44MDY3OTklMkMlMjJsb25naXR1ZGUlMjIlM0EtNzIuNzAxMDg0JTdE&promotionUuid=379574a6-8997-49f2-b795-bcc4b4534a24&targetingStoreTag=restaurant_us_target_all_postmates)",
    );
    await interaction.reply({ embeds: [embed] });
  },
};
