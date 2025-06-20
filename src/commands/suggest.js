const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'suggest',
    aliases: [],
    description: 'Send a suggestion to the suggestion channel',
    data: new SlashCommandBuilder()
        .setName('suggest')
        .setDescription('Send a suggestion to the suggestion channel')
        .addStringOption(option =>
            option.setName('suggestion')
                .setDescription('Your suggestion')
                .setRequired(true)),

    async execute(message, args) {
        const suggestion = args.join(' ');
        if (!suggestion) {
            await message.reply('Please provide a suggestion.');
            return;
        }
        const channelId = process.env.SUGGESTION_CHANNEL;
        const keroId = process.env.KERO_ID;
        const manchildId = process.env.MANCHILD_ID;
        if (!channelId) {
            await message.reply('Suggestion channel is not configured.');
            return;
        }
        const channel = await message.client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            await message.reply('Suggestion channel not found.');
            return;
        }
        // Fetch the latest message by the bot with KERO_ID or MANCHILD_ID
        let suggestionNumber = 1;
        try {
            const messages = await channel.messages.fetch({ limit: 20 });
            let maxNum = 0;
            messages.forEach(m => {
                if ((m.author.id === keroId || m.author.id === manchildId) && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.toLowerCase().startsWith('suggestion #')) {
                    const match = m.embeds[0].title.match(/suggestion #(\d+)/i);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > maxNum) maxNum = num;
                    }
                }
            });
            suggestionNumber = maxNum + 1;
        } catch (e) {
            // fallback to 1
        }
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setTitle(`Suggestion #${suggestionNumber}`)
            .setDescription(suggestion)
            .setFooter({ text: `Suggested by ${message.author.tag} | ${new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}` });
        const sentMsg = await channel.send({ embeds: [embed] });
        await sentMsg.react('✅');
        await sentMsg.react('❌');
        await message.delete();
    },

    async slashExecute(interaction) {
        const suggestion = interaction.options.getString('suggestion');
        const channelId = process.env.SUGGESTION_CHANNEL;
        const keroId = process.env.KERO_ID;
        const manchildId = process.env.MANCHILD_ID;
        if (!channelId) {
            await interaction.reply({ content: 'Suggestion channel is not configured.', ephemeral: true });
            return;
        }
        const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            await interaction.reply({ content: 'Suggestion channel not found.', ephemeral: true });
            return;
        }
        // Fetch the latest message by the bot with KERO_ID or MANCHILD_ID
        let suggestionNumber = 1;
        try {
            const messages = await channel.messages.fetch({ limit: 20 });
            let maxNum = 0;
            messages.forEach(m => {
                if ((m.author.id === keroId || m.author.id === manchildId) && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.toLowerCase().startsWith('suggestion #')) {
                    const match = m.embeds[0].title.match(/suggestion #(\d+)/i);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > maxNum) maxNum = num;
                    }
                }
            });
            suggestionNumber = maxNum + 1;
        } catch (e) {
            // fallback to 1
        }
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`Suggestion #${suggestionNumber}`)
            .setDescription(suggestion)
            .setFooter({ text: `Suggested by ${interaction.user.tag} | ${new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}` });
        const sentMsg = await channel.send({ embeds: [embed] });
        await sentMsg.react('✅');
        await sentMsg.react('❌');
        await interaction.reply({ content: 'Your suggestion has been sent!', ephemeral: true });
    }
}; 