// commands/sendcards.js
const { SlashCommandBuilder } = require('discord.js');

const TARGET_CHANNEL_ID = '1384211131387613266';   // where the cards are posted
const ALLOWED_ROLE_ID  = '1382425956517548134';    // role allowed to run the command

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sendcards')
    .setDescription('Send a multiline list of cards one-by-one to the target channel.')
    .addStringOption(opt =>
      opt.setName('list')
         .setDescription('Paste the card list (one per line, comma-separated).')
         .setRequired(true))
    // no need for channel option now
    .setDefaultMemberPermissions(0),  // everyone blocked by default – we’ll check role manually

  async execute(interaction) {
    // role-gate
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return interaction.reply({ content: '❌ You don’t have permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const raw   = interaction.options.getString('list');
    const cards = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const channel = interaction.client.channels.cache.get(TARGET_CHANNEL_ID);
    if (!channel) {
      return interaction.editReply('⚠️ Target channel not found. Check the ID in the code.');
    }

    for (const card of cards) {
      await channel.send(`\`${card}\``);
      await new Promise(r => setTimeout(r, 1500));   // 1.5-sec drip delay
    }

    await interaction.editReply(`✅ Sent ${cards.length} cards to <#${TARGET_CHANNEL_ID}>.`);
  },
};
