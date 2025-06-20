require('dotenv').config();
const { Client, GatewayIntentBits, Events, Collection, REST, Routes, MessageFlags, InteractionResponseFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const poll = require('./commands/poll.js');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
    ]
});

// Collections to store commands
client.commands = new Map();
client.slashCommands = new Map();

// Load commands from the commands folder
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // Store regular commands
    if ('name' in command) {
        client.commands.set(command.name, command);
    }
    
    // Store slash commands
    if ('data' in command) {
        client.slashCommands.set(command.data.name, command);
    }
}

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, async readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);

    // Send startup message
    const startCommand = require('./commands/start.js');
    await startCommand.execute(readyClient);

    // Register slash commands
    const rest = new REST().setToken(process.env.BOT_TOKEN);
    const slashCommands = Array.from(client.slashCommands.values()).map(cmd => cmd.data.toJSON());

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(readyClient.user.id),
            { body: slashCommands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }

    // Restore poll collectors
    await poll.restorePollCollectors(client);
});

// Handle regular commands
client.on(Events.MessageCreate, async message => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if message starts with the command prefix
    if (message.content.startsWith('\\')) {
        // Split the message into command and arguments
        const args = message.content.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Get the command from the commands collection
        let command = client.commands.get(commandName);
        // If not found, check aliases
        if (!command) {
            command = Array.from(client.commands.values()).find(cmd =>
                cmd.aliases && cmd.aliases.map(a => a.toLowerCase()).includes(commandName)
            );
        }
        // If command doesn't exist, ignore
        if (!command) return;

        try {
            // Execute the command
            await command.execute(message, args);
        } catch (error) {
            console.error(error);
            await message.reply('There was an error executing that command.');
        }
    }
});

// Handle slash commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.slashCommands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.slashExecute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error executing this command!', flags: [MessageFlags.Ephemeral] });
        } else {
            await interaction.reply({ content: 'There was an error executing this command!', flags: [MessageFlags.Ephemeral] });
        }
    }
});

// Log in to Discord with your client's token
client.login(process.env.BOT_TOKEN);
