const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'ping',
    description: 'Shows various latency metrics including bot ping, Discord API latency, and database response time.',
    aliases: [],
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Shows various latency metrics including bot ping, Discord API latency, and database response time.'),
    async execute(message, args) {
        try {
            // Only proceed if the message content is exactly "\\ping"
            if (!message.content.trim().toLowerCase().startsWith('\\ping')) return;

            // Delete the user's message
            await message.delete().catch(() => {});

            // Start measuring time
            const startTime = Date.now();

            // Send a message to measure bot ping
            const sent = await message.channel.send('Measuring...');
            const botPing = sent.createdTimestamp - message.createdTimestamp;

            // Get Discord API latency (WebSocket ping)
            const wsLatency = message.client.ws.ping >= 0 ? message.client.ws.ping : 'N/A';

            // Get database response time (placeholder)
            let dbLatency = 'N/A';
            try {
                const dbStartTime = Date.now();
                // Add your database ping/query here if you have one
                // Example: await db.ping();
                dbLatency = Date.now() - dbStartTime;
            } catch (error) {
                dbLatency = 'N/A';
            }

            // Get memory usage
            const memoryUsage = process.memoryUsage();
            const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;

            // Get uptime
            const uptime = message.client.uptime;
            const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
            const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
            const uptimeSeconds = Math.floor((uptime % (1000 * 60)) / 1000);

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('Pong!')
                .setDescription('Here are the current latency metrics:')
                .addFields(
                    { name: 'Bot Ping', value: `\`${botPing}ms\``, inline: true },
                    { name: 'Discord API Latency', value: `\`${wsLatency}ms\``, inline: true },
                    { name: 'Database Latency', value: `\`${dbLatency}ms\``, inline: true },
                    { name: 'Total Response Time', value: `\`${Date.now() - startTime}ms\``, inline: true },
                    { name: 'Memory Usage', value: `\`${memoryMB}MB\``, inline: true },
                    { name: 'Uptime', value: `\`${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s\``, inline: true }
                )
                .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            // Delete the measuring message and send the embed
            await sent.delete().catch(() => {});
            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error in ping command:', error);
            await message.channel.send('❌ There was an error while measuring latency metrics.');
        }
    },
    async slashExecute(interaction) {
        try {
            // Start measuring time
            const startTime = Date.now();

            // Get Discord API latency (WebSocket ping)
            const wsLatency = interaction.client.ws.ping >= 0 ? interaction.client.ws.ping : 'N/A';

            // Get database response time (placeholder)
            let dbLatency = 'N/A';
            try {
                const dbStartTime = Date.now();
                // Add your database ping/query here if you have one
                // Example: await db.ping();
                dbLatency = Date.now() - dbStartTime;
            } catch (error) {
                dbLatency = 'N/A';
            }

            // Get memory usage
            const memoryUsage = process.memoryUsage();
            const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;

            // Get uptime
            const uptime = interaction.client.uptime;
            const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
            const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
            const uptimeSeconds = Math.floor((uptime % (1000 * 60)) / 1000);

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('Pong!')
                .setDescription('Here are the current latency metrics:')
                .addFields(
                    { name: 'Discord API Latency', value: `\`${wsLatency}ms\``, inline: true },
                    { name: 'Database Latency', value: `\`${dbLatency}ms\``, inline: true },
                    { name: 'Memory Usage', value: `\`${memoryMB}MB\``, inline: true },
                    { name: 'Uptime', value: `\`${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s\``, inline: true },
                    { name: 'Total Response Time', value: `\`${Date.now() - startTime}ms\``, inline: true }
                )
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in ping command:', error);
            await interaction.reply({ content: '❌ There was an error while measuring latency metrics.', ephemeral: true });
        }
    }
}; 