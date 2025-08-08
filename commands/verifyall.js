// commands/verifyall.js

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verifyall')
        .setDescription('Give Verified role to all members, and remove Unverified role (manual run).'),

    async execute(interaction) {
        // Only allow Admins to run this
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }

        const VERIFIED_ROLE_ID = '1400611716718661848';
        const UNVERIFIED_ROLE_ID = '1400611718069092422';

        await interaction.reply('🔄 Fetching members and updating roles... This may take a moment.');

        // Safe fetch with try/catch
        let members;

        try {
            members = await interaction.guild.members.fetch();
        } catch (err) {
            console.error('❌ Failed to fetch members:', err);
            return interaction.followUp('❌ Failed to fetch members — please try again.');
        }

        let verifiedCount = 0;
        let unverifiedRemovedCount = 0;

        for (const [memberId, member] of members) {
            if (!member.user.bot) {
                // Add Verified if missing
                if (!member.roles.cache.has(VERIFIED_ROLE_ID)) {
                    try {
                        await member.roles.add(VERIFIED_ROLE_ID);
                        verifiedCount++;
                    } catch (err) {
                        console.error(`❌ Failed to add Verified to ${member.user.tag}:`, err);
                    }
                }

                // Remove Unverified if present
                if (member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
                    try {
                        await member.roles.remove(UNVERIFIED_ROLE_ID);
                        unverifiedRemovedCount++;
                    } catch (err) {
                        console.error(`❌ Failed to remove Unverified from ${member.user.tag}:`, err);
                    }
                }
            }
        }

        await interaction.followUp(`✅ Done!\n➕ Verified role added to **${verifiedCount}** members.\n➖ Unverified role removed from **${unverifiedRemovedCount}** members.`);
    },
};
