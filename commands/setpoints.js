const { SlashCommandBuilder } = require("discord.js");
const { PermissionFlagsBits } = require("discord.js");
const pool = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setpoints")
    .setDescription("Set a user's points to a specific value (Admin only)")
    .addUserOption((option) =>
      option.setName("target").setDescription("User to set points for").setRequired(true),
    )
    .addIntegerOption((option) =>
      option.setName("amount").setDescription("New point value").setRequired(true),
    ),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "❌ Only administrators can set points.",
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser("target");
    const amount = interaction.options.getInteger("amount");

    try {
      await pool.query(
        "INSERT INTO points (user_id, points) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET points = EXCLUDED.points",
        [target.id, Math.max(0, amount)]
      );

      await interaction.reply(`✅ Set <@${target.id}>'s points to **${amount}**.`);
    } catch (err) {
      console.error("setpoints.js error:", err);
      await interaction.reply({
        content: "❌ Failed to set points due to a database error.",
        ephemeral: true,
      });
    }
  },
};
