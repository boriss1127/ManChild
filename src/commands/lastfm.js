const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Debug logging
console.log('Last.fm API Key type:', typeof process.env.LASTFM_API_KEY);
console.log('Last.fm API Key length:', process.env.LASTFM_API_KEY?.length);

// Check if Last.fm API credentials are set
if (!process.env.LASTFM_API_KEY || !process.env.LASTFM_API_SECRET) {
    console.error('Last.fm API credentials are not set in .env file!');
    console.error('Please add LASTFM_API_KEY and LASTFM_API_SECRET to your .env file');
    process.exit(1);
}

// Store user's Last.fm usernames
const userLastfm = new Map();

// Last.fm API base URL
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

// Path to the JSON file
const JSON_PATH = path.join(__dirname, '..', 'jsons', 'lastfm.json');

// Load existing usernames from JSON
function loadLastfmUsernames() {
    try {
        if (fs.existsSync(JSON_PATH)) {
            const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
            for (const [userId, profileUrl] of Object.entries(data.users)) {
                // Extract username from the Last.fm URL
                const username = profileUrl.split('/').pop();
                userLastfm.set(userId, username);
            }
        }
    } catch (error) {
        console.error('Error loading Last.fm usernames:', error);
    }
}

// Save usernames to JSON
function saveLastfmUsernames() {
    try {
        const data = {
            users: {}
        };
        for (const [userId, username] of userLastfm.entries()) {
            data.users[userId] = `https://www.last.fm/user/${username}`;
        }
        fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error('Error saving Last.fm usernames:', error);
    }
}

// Load usernames when the module is loaded
loadLastfmUsernames();

// Function to make Last.fm API calls
async function lastfmRequest(method, params) {
    try {
        const response = await axios.get(LASTFM_API_URL, {
            params: {
                method,
                api_key: process.env.LASTFM_API_KEY,
                format: 'json',
                ...params
            }
        });
        return response.data;
    } catch (error) {
        console.error('Last.fm API Error:', error.response?.data || error.message);
        throw error;
    }
}

// Function to create Last.fm track URL
function getLastfmTrackUrl(artist, track) {
    return `https://www.last.fm/music/${encodeURIComponent(artist)}/_/${encodeURIComponent(track)}`;
}

// Function to create Last.fm user URL
function getLastfmUserUrl(username) {
    return `https://www.last.fm/user/${encodeURIComponent(username)}`;
}

// Function to format date in DD/MM/YYYY format
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Function to get album cover URL
function getAlbumCoverUrl(track) {
    if (track.image && track.image.length > 0) {
        // Get the largest image (usually the last one in the array)
        return track.image[track.image.length - 1]['#text'];
    }
    return null;
}

// Function to handle nowplaying command
async function handleNowPlaying(messageOrInteraction, isSlash = false) {
    const userId = isSlash ? messageOrInteraction.user.id : messageOrInteraction.author.id;
    const lastfmUsername = userLastfm.get(userId);

    if (!lastfmUsername) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Error')
            .setDescription('Please set your Last.fm username first using `/lastfm set <username>` or `\\lastfm set <username>`')
            .setFooter({ text: `Requested by ${isSlash ? messageOrInteraction.user.tag : messageOrInteraction.author.tag}` })
            .setTimestamp();

        if (isSlash) {
            await messageOrInteraction.reply({ embeds: [embed] });
        } else {
            await messageOrInteraction.reply({ embeds: [embed] });
        }
        return;
    }

    try {
        const nowPlaying = await lastfmRequest('user.getRecentTracks', { 
            user: lastfmUsername,
            limit: 1
        });
        const track = nowPlaying.recenttracks.track[0];
        
        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle(track['@attr']?.nowplaying ? 'Now Playing' : 'Last Played')
            .setDescription(`[**${track.name}**](${getLastfmTrackUrl(track.artist['#text'], track.name)}) by [**${track.artist['#text']}**](https://www.last.fm/music/${encodeURIComponent(track.artist['#text'])})`)
            .setAuthor({ 
                name: lastfmUsername, 
                iconURL: 'https://www.last.fm/static/images/lastfm_avatar_twitter.png',
                url: getLastfmUserUrl(lastfmUsername)
            })
            .setFooter({ text: `Requested by ${isSlash ? messageOrInteraction.user.tag : messageOrInteraction.author.tag}` })
            .setTimestamp();

        // Add album cover if available
        const albumCover = getAlbumCoverUrl(track);
        if (albumCover) {
            embed.setThumbnail(albumCover);
        }

        if (!track['@attr']?.nowplaying) {
            embed.addFields({
                name: '⏰ Played',
                value: formatDate(track.date['#text']),
                inline: true
            });
        }

        if (isSlash) {
            const reply = await messageOrInteraction.reply({ embeds: [embed], fetchReply: true });
            await reply.react('✅');
            await reply.react('❌');
        } else {
            // For prefix commands, fetch the sent message and react as manchild
            const sent = await messageOrInteraction.reply({ embeds: [embed], fetchReply: true });
            await sent.react('✅');
            await sent.react('❌');
        }
    } catch (error) {
        console.error('Last.fm API Error:', error);
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Error')
            .setDescription('There was an error fetching data from Last.fm. Please try again later.')
            .setFooter({ text: `Requested by ${isSlash ? messageOrInteraction.user.tag : messageOrInteraction.author.tag}` })
            .setTimestamp();

        await messageOrInteraction.reply({ embeds: [embed] });
    }
}

// Function to handle set command
async function handleSet(messageOrInteraction, args, isSlash = false) {
    const userId = isSlash ? messageOrInteraction.user.id : messageOrInteraction.author.id;
    const username = isSlash ? messageOrInteraction.options.getString('username') : args[0];

    if (!username) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Error')
            .setDescription('Please provide a Last.fm username.')
            .setFooter({ text: `Requested by ${isSlash ? messageOrInteraction.user.tag : messageOrInteraction.author.tag}` })
            .setTimestamp();

        await messageOrInteraction.reply({ embeds: [embed] });
        return;
    }

    try {
        // Verify the username exists
        const userInfo = await lastfmRequest('user.getInfo', { user: username });
        userLastfm.set(userId, username);
        saveLastfmUsernames();
        
        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle('Last.fm Username Set')
            .setDescription(`Successfully set your Last.fm username to [${username}](${getLastfmUserUrl(username)})`)
            .setFooter({ text: `Requested by ${isSlash ? messageOrInteraction.user.tag : messageOrInteraction.author.tag}` })
            .setTimestamp();

        await messageOrInteraction.reply({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Error')
            .setDescription('Invalid Last.fm username. Please check and try again.')
            .setFooter({ text: `Requested by ${isSlash ? messageOrInteraction.user.tag : messageOrInteraction.author.tag}` })
            .setTimestamp();

        await messageOrInteraction.reply({ embeds: [embed] });
    }
}

// Function to handle login command for prefix usage
async function handleLogin(message, args) {
    const userId = message.author.id;
    const currentUsername = userLastfm.get(userId);
    const newUsername = args[1];

    if (!newUsername) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Error')
            .setDescription('Please provide a Last.fm username to log in. Usage: `\\lastfm login <username>`')
            .setFooter({ text: `Requested by ${message.author.tag}` })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }

    if (currentUsername && currentUsername !== newUsername) {
        // DM the user to confirm switching accounts
        try {
            const dm = await message.author.createDM();
            await dm.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('Confirm Account Switch')
                        .setDescription(`You are already logged in as **${currentUsername}**. Do you want to sign out and log in as **${newUsername}**?\n\nReply with \\yes to confirm or \\no to cancel.`)
                        .setFooter({ text: `Requested by ${message.author.tag}` })
                        .setTimestamp()
                ]
            });

            // Await DM reply (simple message collector, 30s timeout)
            const filter = m => m.author.id === userId && ['\\yes', '\\no'].includes(m.content.trim().toLowerCase());
            const collected = await dm.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
            if (!collected || collected.size === 0) {
                await dm.send('Login cancelled (no response).');
                return;
            }
            const response = collected.first().content.trim().toLowerCase();
            if (response === '\\yes') {
                // Proceed to switch account
                try {
                    await lastfmRequest('user.getInfo', { user: newUsername });
                    userLastfm.set(userId, newUsername);
                    saveLastfmUsernames();
                    await dm.send(`You are now logged in as **${newUsername}**!`);
                } catch (error) {
                    await dm.send('Invalid Last.fm username. Please check and try again.');
                }
            } else {
                await dm.send('Login cancelled.');
            }
        } catch (dmError) {
            await message.reply('Could not send you a DM. Please check your privacy settings.');
        }
        return;
    }

    // If not logged in or logging in as same username, proceed
    try {
        await lastfmRequest('user.getInfo', { user: newUsername });
        userLastfm.set(userId, newUsername);
        saveLastfmUsernames();
        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle('Logged In')
            .setDescription(`You are now logged in as [${newUsername}](${getLastfmUserUrl(newUsername)})!`)
            .setFooter({ text: `Requested by ${message.author.tag}` })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Error')
            .setDescription('Invalid Last.fm username. Please check and try again.')
            .setFooter({ text: `Requested by ${message.author.tag}` })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    }
}

module.exports = {
    name: 'lastfm',
    aliases: ['fm', 'np', 'nowplaying'],
    data: new SlashCommandBuilder()
        .setName('lastfm')
        .setDescription('Last.fm commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set your Last.fm username')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Your Last.fm username')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('nowplaying')
                .setDescription('Show what you\'re currently playing'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('recent')
                .setDescription('Show your recent tracks'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show your Last.fm stats')),

    async execute(message, args) {
        // Handle login command
        if (args[0] && args[0].toLowerCase() === 'login') {
            await handleLogin(message, args);
            return;
        }
        // All commands (\fm, \np, \nowplaying, \lastfm) do the same thing
        if (args.length === 0) {
            return handleNowPlaying(message, false);
        }
        // Only handle 'set' as a special case
        if (args[0].toLowerCase() === 'set') {
            await handleSet(message, args, false);
            return;
        }
        // Any other arguments just show now playing
        await handleNowPlaying(message, false);
    },

    async slashExecute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'set':
                await handleSet(interaction, null, true);
                break;
            case 'nowplaying':
                await handleNowPlaying(interaction, true);
                break;
            case 'recent': {
                const recentTracks = await lastfmRequest('user.getRecentTracks', {
                    user: userLastfm.get(interaction.user.id),
                    limit: 5
                });
                const tracks = recentTracks.recenttracks.track;

                const embed = new EmbedBuilder()
                    .setColor('#1DB954')
                    .setTitle(`📜 Recent Tracks for ${userLastfm.get(interaction.user.id)}`)
                    .setDescription(tracks.map((track, index) => 
                        `${index + 1}. [**${track.name}**](${getLastfmTrackUrl(track.artist['#text'], track.name)}) by [**${track.artist['#text']}**](https://www.last.fm/music/${encodeURIComponent(track.artist['#text'])})`
                    ).join('\n'))
                    .setAuthor({ 
                        name: userLastfm.get(interaction.user.id), 
                        iconURL: 'https://www.last.fm/static/images/lastfm_avatar_twitter.png',
                        url: getLastfmUserUrl(userLastfm.get(interaction.user.id))
                    })
                    .setFooter({ text: `Requested by ${interaction.user.tag}` })
                    .setTimestamp();

                // Add album cover of the most recent track
                const albumCover = getAlbumCoverUrl(tracks[0]);
                if (albumCover) {
                    embed.setThumbnail(albumCover);
                }

                await interaction.reply({ embeds: [embed] });
                break;
            }
            case 'stats': {
                const userInfo = await lastfmRequest('user.getInfo', { user: userLastfm.get(interaction.user.id) });
                const stats = userInfo.user;

                const embed = new EmbedBuilder()
                    .setColor('#1DB954')
                    .setTitle(`📊 Last.fm Stats for ${userLastfm.get(interaction.user.id)}`)
                    .addFields(
                        { name: '🎵 Total Scrobbles', value: stats.playcount, inline: true },
                        { name: '🌍 Country', value: stats.country || 'Not set', inline: true },
                        { name: '📅 Account Created', value: formatDate(stats.registered['#text']), inline: true }
                    )
                    .setAuthor({ 
                        name: userLastfm.get(interaction.user.id), 
                        iconURL: 'https://www.last.fm/static/images/lastfm_avatar_twitter.png',
                        url: getLastfmUserUrl(userLastfm.get(interaction.user.id))
                    })
                    .setFooter({ text: `Requested by ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }
        }
    }
}; 