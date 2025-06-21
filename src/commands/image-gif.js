const { EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const sharp = require('sharp');
const { GifFrame, GifUtil, GifCodec } = require('gifwrap');
const Jimp = require('jimp');
const axios = require('axios');
const path = require('path');

module.exports = {
    name: 'imagetogif',
    description: 'Converts an image attachment to GIF format',
    aliases: ['imgtogif', 'itg'],
    data: new SlashCommandBuilder()
        .setName('imagetogif')
        .setDescription('Converts an image attachment to GIF format')
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('The image to convert to GIF')
                .setRequired(true)),
    async execute(message, args) {
        try {
            // Only proceed if the message content starts with the command
            if (!message.content.trim().toLowerCase().startsWith('\\imagetogif')) return;

            // Check if there's an attachment
            if (!message.attachments || message.attachments.size === 0) {
                await message.reply('❌ Please attach an image to convert to GIF.');
                return;
            }

            const attachment = message.attachments.first();
            
            // Check if the attachment is an image
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
            const fileExtension = path.extname(attachment.name).toLowerCase();
            
            if (!imageExtensions.includes(fileExtension)) {
                await message.reply('❌ Please attach a valid image file (PNG, JPG, JPEG, GIF, BMP, or WebP).');
                return;
            }

            // Send processing message
            const processingMsg = await message.channel.send('🔄 Converting image to GIF...');

            try {
                // Download the image
                const response = await axios.get(attachment.url, { 
                    responseType: 'arraybuffer',
                    timeout: 10000, // 10 second timeout
                    validateStatus: function (status) {
                        return status >= 200 && status < 300; // Accept only 2xx status codes
                    }
                });
                const imageBuffer = Buffer.from(response.data);

                // Convert to GIF
                const gifBuffer = await this.convertToGif(imageBuffer);

                // Create attachment
                const gifAttachment = new AttachmentBuilder(gifBuffer, { name: 'manchild.gif' });

                // Create embed
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✅ Image to GIF Conversion Complete!')
                    .setDescription(`Successfully converted \`${attachment.name}\` to GIF format.`)
                    .addFields(
                        { name: 'Original Size', value: `${(imageBuffer.length / 1024).toFixed(2)} KB`, inline: true },
                        { name: 'GIF Size', value: `${(gifBuffer.length / 1024).toFixed(2)} KB`, inline: true },
                        { name: 'Format', value: 'GIF', inline: true }
                    )
                    .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                    .setTimestamp();

                // Delete the user's message and processing message, then send result
                await message.delete().catch(() => {});
                await processingMsg.delete().catch(() => {});
                await message.channel.send({ embeds: [embed], files: [gifAttachment] });

            } catch (error) {
                console.error('Error converting image to GIF:', error);
                let errorMessage = '❌ Failed to convert image to GIF.';
                
                if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    if (error.response.status === 404) {
                        errorMessage = '❌ Image file not found. The attachment may have expired or been deleted.';
                    } else if (error.response.status === 403) {
                        errorMessage = '❌ Access denied to the image file.';
                    } else {
                        errorMessage = `❌ Failed to download image (HTTP ${error.response.status}).`;
                    }
                } else if (error.request) {
                    // The request was made but no response was received
                    errorMessage = '❌ Failed to download image. Please check your internet connection.';
                } else {
                    // Something happened in setting up the request that triggered an Error
                    errorMessage = '❌ Failed to process image. Please try again with a different image.';
                }
                
                await processingMsg.edit(errorMessage);
            }

        } catch (error) {
            console.error('Error in imagetogif command:', error);
            await message.channel.send('❌ There was an error while processing the image.');
        }
    },
    async slashExecute(interaction) {
        try {
            const attachment = interaction.options.getAttachment('image');
            
            // Check if the attachment is an image
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
            const fileExtension = path.extname(attachment.name).toLowerCase();
            
            if (!imageExtensions.includes(fileExtension)) {
                await interaction.reply({ 
                    content: '❌ Please provide a valid image file (PNG, JPG, JPEG, GIF, BMP, or WebP).', 
                    ephemeral: true 
                });
                return;
            }

            // Defer reply since processing might take time
            await interaction.deferReply();

            try {
                // Download the image
                const response = await axios.get(attachment.url, { 
                    responseType: 'arraybuffer',
                    timeout: 10000, // 10 second timeout
                    validateStatus: function (status) {
                        return status >= 200 && status < 300; // Accept only 2xx status codes
                    }
                });
                const imageBuffer = Buffer.from(response.data);

                // Convert to GIF
                const gifBuffer = await this.convertToGif(imageBuffer);

                // Create attachment
                const gifAttachment = new AttachmentBuilder(gifBuffer, { name: 'converted.gif' });

                // Create embed
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✅ Image to GIF Conversion Complete!')
                    .setDescription(`Successfully converted \`${attachment.name}\` to GIF format.`)
                    .addFields(
                        { name: 'Original Size', value: `${(imageBuffer.length / 1024).toFixed(2)} KB`, inline: true },
                        { name: 'GIF Size', value: `${(gifBuffer.length / 1024).toFixed(2)} KB`, inline: true },
                        { name: 'Format', value: 'GIF', inline: true }
                    )
                    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed], files: [gifAttachment] });

            } catch (error) {
                console.error('Error converting image to GIF:', error);
                let errorMessage = '❌ Failed to convert image to GIF.';
                
                if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    if (error.response.status === 404) {
                        errorMessage = '❌ Image file not found. The attachment may have expired or been deleted.';
                    } else if (error.response.status === 403) {
                        errorMessage = '❌ Access denied to the image file.';
                    } else {
                        errorMessage = `❌ Failed to download image (HTTP ${error.response.status}).`;
                    }
                } else if (error.request) {
                    // The request was made but no response was received
                    errorMessage = '❌ Failed to download image. Please check your internet connection.';
                } else {
                    // Something happened in setting up the request that triggered an Error
                    errorMessage = '❌ Failed to process image. Please try again with a different image.';
                }
                
                await interaction.editReply({ 
                    content: errorMessage,
                    ephemeral: true 
                });
            }

        } catch (error) {
            console.error('Error in imagetogif slash command:', error);
            await interaction.reply({ 
                content: '❌ There was an error while processing the image.', 
                ephemeral: true 
            });
        }
    },
    async convertToGif(imageBuffer) {
        try {
            // Process the image with sharp to ensure it's in the right format and size
            const processedImage = await sharp(imageBuffer)
                .resize(800, 800, { 
                    fit: 'inside', 
                    withoutEnlargement: true 
                })
                .png()
                .toBuffer();

            // Use Jimp to read the processed image
            const jimpImage = await Jimp.read(processedImage);
            
            // Convert to GIF using Jimp's built-in GIF writer
            const gifBuffer = await jimpImage.getBufferAsync(Jimp.MIME_GIF);
            
            return gifBuffer;
        } catch (error) {
            console.error('Error in convertToGif:', error);
            throw error;
        }
    }
};