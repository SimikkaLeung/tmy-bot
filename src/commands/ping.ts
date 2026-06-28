import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong and shows bot latency!');

export async function execute(interaction: ChatInputCommandInteraction) {

    const sent = await interaction.reply({ content: 'Pinging...', withResponse: true });

    const latency = sent.resource?.message?.createdTimestamp ? 
    sent.resource?.message?.createdTimestamp - interaction.createdTimestamp : 9999999;

    await interaction.editReply(`🏓 Pong! Latency is **${latency}ms**.`);
}