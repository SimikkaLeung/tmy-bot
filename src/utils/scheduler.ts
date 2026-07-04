import { Client, Collection, GatewayIntentBits, TextChannel, ThreadChannel } from 'discord.js';
import { getRandomTrackFromThread } from './trackPicker.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

export function startDiscordScheduler(client: Client) {

    setInterval(async () => {
        const now = Date.now();

        const channels = client.channels.cache.filter(
            c => c.isTextBased() && !c.isThread()
        ) as Collection<string, TextChannel>;
        
        let scheduleThread: ThreadChannel | null = null;
        for (const [_, ch] of channels) {
            const found = ch.threads.cache.find(t => t.name === 'tmy-schedules');
            if (found) {
                scheduleThread = found as ThreadChannel;
                break;
            }
        }

        if (!scheduleThread) return; 

        try {
            const messages = await scheduleThread.messages.fetch({ limit: 20 });

            const configMessages = messages.filter(m => m.content.includes('⚙️ **TMY AUTOMATION CONFIGURATION**'));

            for (const [_, msg] of configMessages) {
                const text = msg.content;

                const srcId = text.match(/\[SRC:(\d+)\]/)?.[1];
                const dstId = text.match(/\[DST:(\d+)\]/)?.[1];
                const freq  = text.match(/\[FREQ:(.*?)\]/)?.[1];  // 'hourly' | 'daily' | 'weekly'
                const timeStr = text.match(/\[TIME:(.*?)\]/)?.[1] || "00:00"; // e.g. "12:00"
                const actionStr = text.match(/\[ACT:(.*?)\]/)?.[1];
                const lastRun = parseInt(text.match(/\[RUN:(\d+)\]?/)?.[1] || text.match(/\[RUN:(\d+)\]/)?.[1] || "0");

                if (!srcId || !dstId || !freq) continue;

                let shouldTrigger = false;

                if (freq === 'hourly') {
                    if (now - lastRun >= ONE_HOUR_MS) {
                        shouldTrigger = true;
                    }
                } else if (freq === 'daily') {
                    const [targetHour, targetMinute] = timeStr.split(':').map(Number);
                    
                    const currentWorldDate = new Date(now);
                    const targetExecutionDate = new Date(now);
                    targetExecutionDate.setUTCHours(targetHour ?? 0, targetMinute, 0, 0);
                    
                    const lastRunDate = new Date(lastRun);

                    // Trigger if the current clock crossed the target hour today, 
                    // AND the last run didn't happen yet during this target period.
                    if (currentWorldDate >= targetExecutionDate && lastRunDate < targetExecutionDate) {
                        shouldTrigger = true;
                    }
                }

                if (shouldTrigger) {
                    try {
                        const targetChannel = await client.channels.fetch(dstId) as TextChannel;
                        const playlistThread = await client.channels.fetch(srcId) as ThreadChannel;

                        if (targetChannel && playlistThread) {
                            console.log(`⏱️ Auto-triggering automation for thread: ${playlistThread.name}`);
                            
                            const randomTrack = await getRandomTrackFromThread(playlistThread);

                            if (!randomTrack) {
                                await targetChannel.send(`⚠️ Scheduled event triggered, but I couldn't find any tracks inside the **#${playlistThread.name}** thread.`);
                            } else {
                                let outputMessage = "";

                                if (actionStr === 'yt-roulette') {
                                    outputMessage = `🎲 **Scheduled YT Roulette Drop!**\n${randomTrack}`;
                                    await targetChannel.send(outputMessage);
                                } 
                                
                                // else if (actionStr === 'lyric') {
                                //     // Fetch lyric logic (we will create this function next!)
                                //     const lyricBlock = await fetchLyricsForTrack(randomTrack);
                                //     outputMessage = `🎤 **Scheduled Lyric Drop!**\n${lyricBlock}`;
                                //     await targetChannel.send(outputMessage);
                                // } 
                                
                                // else if (actionStr === 'both') {
                                //     const lyricBlock = await fetchLyricsForTrack(randomTrack);
                                //     outputMessage = `✨ **Scheduled Mega Drop! (Roulette + Lyrics)**\n🎬 **Track:** ${randomTrack}\n\n🎤 **Lyrics Preview:**\n${lyricBlock}`;
                                //     await targetChannel.send(outputMessage);
                                // }
                            }
                        }
                    } catch (fetchError) {
                        console.error("Could not reach destination channel or thread for schedule:", fetchError);
                    }

                    // Update Discord's "Database" entry message with the new run timestamp
                    const updatedText = text.replace(/\[RUN:\d+\]/, `[RUN:${now}]`)
                                            .replace(/\*Last updated: .*\*$/, `*Last updated: <t:${Math.floor(now / 1000)}:R>*`);
                    
                    await msg.edit(updatedText);
                }
            }
        } catch (error) {
            console.error("Scheduler loop execution encountered an error:", error);
        }
    }, 60000); // Ticks precisely every 60 seconds
}