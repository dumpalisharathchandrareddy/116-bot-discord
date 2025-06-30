const { SlashCommandBuilder } = require('discord.js');

const TARGET_CHANNEL_ID = '1384211131387613266';   // ✅ Channel where cards will be sent
const ALLOWED_ROLE_ID   = '1382425956517548134';   // ✅ Role allowed to use the command

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sendcards')
    .setDescription('Send a multiline list of cards one-by-one to the target channel.')
    .addStringOption(option =>
      option.setName('list')
            .setDescription('Paste the card list (one per line, format: card,exp,cvv,zip)')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(0), // block by default; we check role manually

  async execute(interaction) {
    // Check for allowed role
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const rawInput = interaction.options.getString('list').trim();
    const cards = rawInput.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    const channel = interaction.client.channels.cache.get(TARGET_CHANNEL_ID);
    if (!channel) {
      return interaction.editReply('⚠️ Target channel not found. Please check the channel ID.');
    }

    let sent = 0;

    for (const card of cards) {
      try {
        // Send each card in a code block with copy button look
        await channel.send(`\`\`\`\n${card}\n\`\`\``);
        await new Promise(res => setTimeout(res, 1500)); // 1.5-second drip delay
        sent++;
      } catch (err) {
        console.error(`❌ Failed to send: ${card}`, err);
      }
    }

    await interaction.editReply(`✅ Sent ${sent} card(s) to <#${TARGET_CHANNEL_ID}>.`);
  },
};
