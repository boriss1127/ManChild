const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'start',
    async execute(client) {
        // Get the channel IDs from .env
        const channelIds = process.env.STARTUP_CHANNELS ? process.env.STARTUP_CHANNELS.split(',') : [];
        
        if (channelIds.length === 0) {
            console.log('No startup channels specified in .env');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Manchild is on!')
            .setDescription('[Best Song Ever](<https://open.spotify.com/album/3wRHV5fOeUcM5hvYzWZsic?si=a2242edd082b43fd>)')
            .setTimestamp()

        // Send the embed to all specified channels
        for (const channelId of channelIds) {
            try {
                const channel = await client.channels.fetch(channelId.trim());
                if (channel) {
                    await channel.send({ embeds: [embed] });
                    console.log(`Startup message sent to channel ${channelId}`);
                }
            } catch (error) {
                console.error(`Failed to send startup message to channel ${channelId}:`, error);
            }
        }
    }
}; 