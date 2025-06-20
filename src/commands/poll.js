const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const POLLS_PATH = path.join(__dirname, '../jsons/polls.json');

function parseTime(timeStr) {
    const match = timeStr.match(/^(\d+)([smhd])$/i);
    if (!match) return null;
    let [ , num, unit ] = match;
    num = parseInt(num, 10);
    let ms = 0;
    switch (unit.toLowerCase()) {
        case 's': ms = num * 1000; break;
        case 'm': ms = num * 60 * 1000; break;
        case 'h': ms = num * 60 * 60 * 1000; break;
        case 'd': ms = num * 24 * 60 * 60 * 1000; break;
        default: return null;
    }
    if (ms > 30 * 24 * 60 * 60 * 1000) return null; // max 30d
    return ms;
}

function getTimeString(timeStr) {
    const match = timeStr.match(/^(\d+)([smhd])$/i);
    if (!match) return null;
    let [ , num, unit ] = match;
    num = parseInt(num, 10);
    switch (unit.toLowerCase()) {
        case 's': return `${num} second${num === 1 ? '' : 's'}`;
        case 'm': return `${num} minute${num === 1 ? '' : 's'}`;
        case 'h': return `${num} hour${num === 1 ? '' : 's'}`;
        case 'd': return `${num} day${num === 1 ? '' : 's'}`;
        default: return null;
    }
}

function loadPolls() {
    try {
        const data = fs.readFileSync(POLLS_PATH, 'utf8');
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
}

function savePolls(polls) {
    fs.writeFileSync(POLLS_PATH, JSON.stringify(polls, null, 2));
}

async function sendPoll({ client, channel, author, header, options, timeStr, interaction, message, restoring, pollId, votes: initialVotes, createdAt, endsAt }) {
    const embed = new EmbedBuilder()
        .setTitle(header)
        .setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() })
        .setDescription(options.map((opt, i) => `**${i + 1}.** ${opt}`).join('\n'))
        .setFooter({ text: `Poll by ${author.tag} | Ends in ${getTimeString(timeStr)}` })
        .setColor('#00b0f4');

    const optionButtons = options.map((opt, i) => new ButtonBuilder()
        .setCustomId(`poll_option_${i}`)
        .setLabel(`${i + 1}`)
        .setStyle(ButtonStyle.Primary)
    );
    const resultsButton = new ButtonBuilder()
        .setCustomId('poll_results')
        .setLabel('Results')
        .setStyle(ButtonStyle.Secondary);

    // Split option buttons into two rows (max 5 per row)
    const firstRowButtons = optionButtons.slice(0, 5);
    const secondRowButtons = optionButtons.slice(5, 10);
    const resultsButtonRow = [resultsButton];
    const actionRows = [];
    if (firstRowButtons.length) actionRows.push(new ActionRowBuilder().addComponents(firstRowButtons));
    if (secondRowButtons.length) actionRows.push(new ActionRowBuilder().addComponents(secondRowButtons));
    actionRows.push(new ActionRowBuilder().addComponents(resultsButtonRow));

    const sentMsg = restoring
        ? await channel.messages.fetch(pollId).catch(() => null)
        : await channel.send({ embeds: [embed], components: actionRows });
    if (!sentMsg) return;
    if (message) await message.delete().catch(() => {});
    if (interaction) await interaction.reply({ content: 'Poll created!', ephemeral: true });

    // Persistent poll state
    const polls = loadPolls();
    const pollKey = sentMsg.id;
    const pollData = {
        messageId: sentMsg.id,
        channelId: channel.id,
        authorId: author.id,
        authorTag: author.tag,
        authorAvatar: author.displayAvatarURL(),
        header,
        options,
        timeStr,
        createdAt: createdAt || Date.now(),
        endsAt: endsAt || (Date.now() + parseTime(timeStr)),
        votes: initialVotes || {},
    };
    if (!restoring) {
        polls[pollKey] = pollData;
        savePolls(polls);
    }
    // Use Map for votes in memory
    const votes = new Map(Object.entries(pollData.votes));
    function getCurrentWinnerIndexes() {
        const tally = Array(options.length).fill(0);
        for (const v of votes.values()) {
            const idx = parseInt(v.split('_').pop(), 10);
            if (!isNaN(idx) && tally[idx] !== undefined) tally[idx]++;
        }
        const maxVotes = Math.max(...tally);
        if (maxVotes === 0) return [];
        return tally.map((v, i) => v === maxVotes ? i : -1).filter(i => i !== -1);
    }
    function getResultsEmbed() {
        const tally = Array(options.length).fill(0);
        const voters = Array(options.length).fill(null).map(() => []);
        for (const [userId, v] of votes.entries()) {
            const idx = parseInt(v.split('_').pop(), 10);
            if (!isNaN(idx) && tally[idx] !== undefined) {
                tally[idx]++;
                voters[idx].push(userId);
            }
        }
        const maxVotes = Math.max(...tally);
        const winners = getCurrentWinnerIndexes();
        let desc = options.map((opt, i) => `**${i + 1}.** ${opt} — ${tally[i]} vote${tally[i] === 1 ? '' : 's'}${winners.includes(i) && maxVotes > 0 ? ' (winning)' : ''}\n${voters[i].map(uid => `<@${uid}>`).join(', ')}`).join('\n\n');
        if (maxVotes === 0) desc += '\nNo votes yet.';
        return new EmbedBuilder()
            .setTitle(`Results for: ${header}`)
            .setDescription(desc)
            .setColor('#b4b4b4');
    }

    const collector = sentMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: pollData.endsAt - Date.now() });

    collector.on('collect', async i => {
        if (i.customId === 'poll_results') {
            await i.reply({ embeds: [getResultsEmbed()], ephemeral: true });
            return;
        }
        if (votes.has(i.user.id)) {
            await i.reply({ content: 'You have already voted in this poll.', ephemeral: true });
            return;
        }
        votes.set(i.user.id, i.customId);
        // Persist vote
        const polls = loadPolls();
        if (polls[pollKey]) {
            polls[pollKey].votes[i.user.id] = i.customId;
            savePolls(polls);
        }
        const optionIndex = parseInt(i.customId.split('_').pop(), 10);
        await i.reply({ content: `You voted for option ${optionIndex + 1}`, ephemeral: true });
    });

    collector.on('end', async () => {
        // Tally votes and send results
        const tally = Array(options.length).fill(0);
        for (const v of votes.values()) {
            const idx = parseInt(v.split('_').pop(), 10);
            if (!isNaN(idx) && tally[idx] !== undefined) tally[idx]++;
        }
        const maxVotes = Math.max(...tally);
        const winners = getCurrentWinnerIndexes();
        let resultText = '';
        if (maxVotes === 0) {
            resultText = 'No votes were cast.';
        } else if (winners.length === 1) {
            resultText = `Option "${options[winners[0]]}" is the winner!`;
        } else {
            resultText = `It's a tie between: ${winners.map(i => `"${options[i]}"`).join(', ')}`;
        }
        await sentMsg.edit({
            embeds: [
                EmbedBuilder.from(embed)
                    .setFooter({ text: `Poll ended | ${resultText}` })
            ],
            components: [
                ...(firstRowButtons.length ? [new ActionRowBuilder().addComponents(firstRowButtons.map(b => b.setDisabled(true)))] : []),
                ...(secondRowButtons.length ? [new ActionRowBuilder().addComponents(secondRowButtons.map(b => b.setDisabled(true)))] : []),
                new ActionRowBuilder().addComponents([resultsButton.setDisabled(true)])
            ]
        });
        // Send public results embed with poll ended note
        const resultsEmbed = getResultsEmbed()
            .setFooter({ text: `Poll ended` });
        await channel.send({ embeds: [resultsEmbed] });
        // Remove from persistent storage
        const polls = loadPolls();
        delete polls[pollKey];
        savePolls(polls);
    });
}

// Restore all active polls on startup
async function restorePollCollectors(client) {
    const polls = loadPolls();
    for (const pollKey in polls) {
        const poll = polls[pollKey];
        const channel = await client.channels.fetch(poll.channelId).catch(() => null);
        if (!channel) continue;
        // If poll expired, end it immediately
        if (Date.now() >= poll.endsAt) {
            // End poll (simulate collector end)
            await sendPoll({ client, channel, author: { id: poll.authorId, tag: poll.authorTag, displayAvatarURL: () => poll.authorAvatar }, header: poll.header, options: poll.options, timeStr: poll.timeStr, restoring: true, pollId: poll.messageId, votes: poll.votes, createdAt: poll.createdAt, endsAt: poll.endsAt });
        } else {
            // Restore collector
            await sendPoll({ client, channel, author: { id: poll.authorId, tag: poll.authorTag, displayAvatarURL: () => poll.authorAvatar }, header: poll.header, options: poll.options, timeStr: poll.timeStr, restoring: true, pollId: poll.messageId, votes: poll.votes, createdAt: poll.createdAt, endsAt: poll.endsAt });
        }
    }
}

module.exports = {
    name: 'poll',
    aliases: [],
    description: 'Create a poll with buttons',
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a poll with buttons')
        .addStringOption(opt => opt.setName('header').setDescription('Poll header').setRequired(true))
        .addStringOption(opt => opt.setName('option1').setDescription('Option 1').setRequired(true))
        .addStringOption(opt => opt.setName('option2').setDescription('Option 2').setRequired(true))
        .addStringOption(opt => opt.setName('time').setDescription('Poll duration (e.g. 10s, 5m, 2h, 7d)').setRequired(true))
        .addStringOption(opt => opt.setName('option3').setDescription('Option 3').setRequired(false))
        .addStringOption(opt => opt.setName('option4').setDescription('Option 4').setRequired(false))
        .addStringOption(opt => opt.setName('option5').setDescription('Option 5').setRequired(false))
        .addStringOption(opt => opt.setName('option6').setDescription('Option 6').setRequired(false))
        .addStringOption(opt => opt.setName('option7').setDescription('Option 7').setRequired(false))
        .addStringOption(opt => opt.setName('option8').setDescription('Option 8').setRequired(false))
        .addStringOption(opt => opt.setName('option9').setDescription('Option 9').setRequired(false))
        .addStringOption(opt => opt.setName('option10').setDescription('Option 10').setRequired(false)),

    async execute(message, args) {
        // Join the message content after the command prefix
        const content = message.content.slice(5).trim(); // remove "\\poll"
        // Match all <...> groups
        const optionMatches = [...content.matchAll(/<([^>]*)>/g)].map(m => m[1].trim());
        // Find the <time:...> entry
        const timeMatchIndex = optionMatches.findIndex(opt => opt.toLowerCase().startsWith('time:'));
        if (timeMatchIndex === -1) return message.reply('You must specify the time as `<time:5m>` or similar.');  
        const timeStr = optionMatches[timeMatchIndex].slice(5).trim();
        const ms = parseTime(timeStr);
        if (!ms) return message.reply('Invalid time format or exceeds 30d. Use e.g. <time:10s>, <time:5m>, <time:2h>, <time:7d>, max 30d.');
        // All other <...> are options
        const options = optionMatches.filter((_, i) => i !== timeMatchIndex);
        if (options.length < 2 || options.length > 10) return message.reply('You must provide between 2 and 10 options.');
        // Header is everything before the first <
        const header = content.split('<')[0].trim();
        if (!header) return message.reply('You must provide a poll header before the first <.');
        const channelId = process.env.POLLS_CHANNEL;
        if (!channelId) return message.reply('Polls channel is not configured.');
        const channel = await message.client.channels.fetch(channelId).catch(() => null);
        if (!channel) return message.reply('Polls channel not found.');
        await sendPoll({ client: message.client, channel, author: message.author, header, options, timeStr, message });
    },

    async slashExecute(interaction) {
        const header = interaction.options.getString('header');
        const timeStr = interaction.options.getString('time');
        const ms = parseTime(timeStr);
        if (!ms) return interaction.reply({ content: 'Invalid time format or exceeds 30d. Use e.g. 10s, 5m, 2h, 7d, max 30d.', ephemeral: true });
        const options = [];
        for (let i = 1; i <= 10; i++) {
            const opt = interaction.options.getString(`option${i}`);
            if (opt) options.push(opt);
        }
        if (options.length < 2) return interaction.reply({ content: 'You must provide at least 2 options.', ephemeral: true });
        const channelId = process.env.POLLS_CHANNEL;
        if (!channelId) return interaction.reply({ content: 'Polls channel is not configured.', ephemeral: true });
        const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
        if (!channel) return interaction.reply({ content: 'Polls channel not found.', ephemeral: true });
        await sendPoll({ client: interaction.client, channel, author: interaction.user, header, options, timeStr, interaction });
    },

    restorePollCollectors,
}; 