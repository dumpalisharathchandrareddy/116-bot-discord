const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const pointsFile = "./points.json";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setpoints")
    .setDescription("Set a user's points to a specific value")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("User to set points for")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("New point value")
        .setRequired(true),
    ),
  async execute(interaction) {
    const target = interaction.options.getUser("target");
    const amount = interaction.options.getInteger("amount");

    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({
        content: "Only admins can set points.",
        ephemeral: true,
      });
    }

    const points = JSON.parse(fs.readFileSync(pointsFile, "utf-8"));
    points[target.id] = Math.max(0, amount);
    fs.writeFileSync(pointsFile, JSON.stringify(points, null, 2));

    await interaction.reply(`Set <@${target.id}>'s points to **${amount}**.`);
  },
};
