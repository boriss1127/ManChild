const { SlashCommandBuilder } = require('discord.js');

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
            const webhook = await interaction.channel.createWebhook({
                name: interaction.user.username,
                avatar: interaction.user.displayAvatarURL(),
            });
            await interaction.deferReply({ ephemeral: true }); // optional: avoids interaction timeout
            await interaction.deleteReply(); // Clean up thinking message
            await webhook.send(text);
            await webhook.delete();
            return;
        }

        // ✅ Case: /say <message> false true — bot says it, with reply attribution
        if (!stateAuthor && stateUsed) {
            await interaction.reply({ content: text }); // visible to everyone
            return;
        }

        // ✅ Case: /say <message> false false — bot says it, no reply attribution
        if (!stateAuthor && !stateUsed) {
            await interaction.deferReply({ ephemeral: true });
            await interaction.deleteReply(); // clean up thinking msg
            await interaction.channel.send(text); // public, clean
            return;
        }
    },
};
