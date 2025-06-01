const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const fs = require("fs");

const COMPLETED_CATEGORY_ID = "1374659946603483136";
const LOG_CHANNEL_ID = "1374665062635147304";
const CUSTOMER_ROLE_ID = "1378016352169754695";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1369794789553475704";
const OWNER_ID = "666746569193816086";
const owedFile = "./owed.json";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("completed")
    .setDescription(
      "Mark this ticket completed, update owed, assign Customer, auto-close (Staff only)",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    // Only allow in ticket channels
    if (!interaction.channel.name.startsWith("ticket-")) {
      return interaction.reply({
        content: "This command can only be used in ticket channels.",
        ephemeral: true,
      });
    }

    // Check Staff role by ID → SAFER
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({
        content: "❌ Only Staff can use this command.",
        ephemeral: true,
      });
    }

    try {
      // Load owed
      let owed = {};
      if (fs.existsSync(owedFile)) {
        owed = JSON.parse(fs.readFileSync(owedFile));
      }

      // If NOT OWNER, update owed
      if (interaction.user.id !== OWNER_ID) {
        if (!owed[interaction.user.id]) {
          owed[interaction.user.id] = { orders: 1, total: 1 };
        } else {
          owed[interaction.user.id].orders += 1;
          owed[interaction.user.id].total += 1;
        }
        fs.writeFileSync(owedFile, JSON.stringify(owed, null, 2));
      }

      // Move channel
      await interaction.channel.setParent(COMPLETED_CATEGORY_ID, {
        lockPermissions: false,
      });

      // Assign Customer role
      const customerRole = interaction.guild.roles.cache.get(CUSTOMER_ROLE_ID);
      if (customerRole) {
        const members = interaction.channel.members;
        members.forEach((member) => {
          if (member.user.bot) return;
          if (member.roles.cache.has(STAFF_ROLE_ID)) return;
          if (!member.roles.cache.has(customerRole.id)) {
            member.roles.add(customerRole).catch(() => {});
          }
        });
      }

      // Public message in ticket
      await interaction.channel.send(
        `✅ This ticket has been marked as completed by <@${interaction.user.id}>!\n` +
          `⏳ This ticket will automatically close in **2.5 hours**.`,
      );

      // Ephemeral message to staff (skip owed if OWNER)
      let staffMessage = `✅ Ticket moved and logged. Auto-close scheduled.`;
      if (interaction.user.id !== OWNER_ID) {
        const orders = owed[interaction.user.id]?.orders || 0;
        const total = owed[interaction.user.id]?.total || 0;
        staffMessage =
          `✅ You (<@${interaction.user.id}>) have completed **${orders} orders** and owe **$${total}**.\n` +
          `Ticket moved and logged. Auto-close scheduled.`;
      }

      await interaction.reply({
        content: staffMessage,
        ephemeral: true,
      });

      // Log to log channel
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        await logChannel.send(
          `🗂️ Ticket \`${interaction.channel.name}\` was marked as completed and moved by <@${interaction.user.id}> at <t:${Math.floor(Date.now() / 1000)}:f>.`,
        );
      }

      // Auto delete after 2.5 hours (2.5 * 60 * 60 * 1000 = 9000000 ms)
      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (err) {
          console.error("Failed to auto-delete ticket:", err);
        }
      }, 9000000); // 2.5h
    } catch (err) {
      console.error(err);
      await interaction.reply({
        content:
          "❌ Failed to complete the ticket or update owed data. Check bot permissions!",
        ephemeral: true,
      });
    }
  },
};
