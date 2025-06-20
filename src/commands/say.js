const { SlashCommandBuilder, MessageFlags, ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'say',
    description: 'Makes the bot say something',
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Makes the bot say something')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to say')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('state_author')
                .setDescription('Should the message appear as if sent by you?')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('state_used')
                .setDescription('Should it show who used the command?')
                .setRequired(true)),

    async execute(message, args) {
        const text = args.join(' ');
        if (!text) return;
        await message.delete();
        message.channel.send(text);
    },

    async slashExecute(interaction) {
        const text = interaction.options.getString('message');
        const stateAuthor = interaction.options.getBoolean('state_author');
        const stateUsed = interaction.options.getBoolean('state_used');

        // ❌ Case: /say <message> true true — silently ignore
        if (stateAuthor && stateUsed) {
            // Do not reply, show nothing to user, prevent any output
            return;
        }

        // ✅ Case: /say <message> true false — webhook as user
        if (stateAuthor && !stateUsed) {
            // Strict check for guild context and permissions for webhook creation
            if (!interaction.guild || !interaction.channel || !interaction.guild.members.me || !interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageWebhooks) || (interaction.channel.type !== ChannelType.GuildText && interaction.channel.type !== ChannelType.GuildPublicThread && interaction.channel.type !== ChannelType.GuildPrivateThread)) {
                await interaction.reply({ content: 'I cannot send messages as a user via webhook here. This is typically because I am not in this server, or I do not have the "Manage Webhooks" permission, or this is not a server text channel/thread.', flags: [MessageFlags.Ephemeral] });
                return;
            }

            // At this point, the bot is in a suitable guild channel and has permissions for webhook.
            try {
                const webhook = await interaction.channel.createWebhook({
                    name: interaction.user.username,
                    avatar: interaction.user.displayAvatarURL(),
                });
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); // optional: avoids interaction timeout
                await interaction.deleteReply(); // Clean up thinking message
                await webhook.send(text);
                await webhook.delete();
                return;
            } catch (error) {
                console.error("Error creating webhook:", error);
                await interaction.reply({ content: 'An unexpected error occurred while trying to send as user via webhook. Please check bot permissions and channel type.', flags: [MessageFlags.Ephemeral] });
                return;
            }
        }

        // ✅ Case: /say <message> false true — bot says it, with reply attribution
        if (!stateAuthor && stateUsed) {
            await interaction.reply({ content: text }); // visible to everyone
            return;
        }

        // ✅ Case: /say <message> false false — bot says it, no reply attribution
        // User wants: initial ephemeral message, then a public message.
        if (!stateAuthor && !stateUsed) {
            await interaction.deferReply({ content: 'Thinking... (only visible to you)', flags: [MessageFlags.Ephemeral] }); // Initial ephemeral thinking message

            // If the bot is not in the guild, it cannot send a regular public message to the channel.
            // It can only send a public interaction follow-up.
            if (!interaction.guild || !interaction.guild.members.me) {
                await interaction.followUp({ content: 'I am not in this server, so I cannot send a regular message to the channel. Here is my public response as an application command: "' + text + '"!', ephemeral: false });
            } else {
                // If the bot is in the guild, attempt to send a regular message to the channel.
                if (interaction.channel && (interaction.channel.type === ChannelType.GuildText || interaction.channel.type === ChannelType.GuildPublicThread || interaction.channel.type === ChannelType.GuildPrivateThread)) {
                    try {
                        await interaction.channel.send(text);
                        await interaction.deleteReply(); // Clean up the deferred reply
                    } catch (sendError) {
                        console.error("Error sending message to channel:", sendError);
                        await interaction.followUp({ content: 'I am in this server, but encountered an error trying to send a regular message to this channel. This might be due to permissions. Here is my public response as an application command: "' + text + '"!', ephemeral: false });
                    }
                } else if (interaction.channel && interaction.channel.type === ChannelType.DM) {
                    // If it's a DM, respond publicly in DM as an interaction response.
                    await interaction.followUp({ content: text, ephemeral: false });
                } else {
                    // Fallback for non-text channels in guild (e.g., Voice, Category)
                    await interaction.followUp({ content: 'I am in this server, but cannot send a regular message to this type of channel. Here is my public response as an application command: "' + text + '"!', ephemeral: false });
                }
            }
            return;
        }
    }
};
