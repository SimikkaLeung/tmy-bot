import { Client, Collection, GatewayIntentBits, TextChannel, ThreadChannel, type AnyThreadChannel } from 'discord.js';
import { getRandomTrackFromThread } from './trackPicker.js';
import { getRandomTrackFromPlaylist } from './youtube.js';
import { extractPlaylistId } from '../commands/yt-roulette.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

export function startDiscordScheduler(client: Client) {

    setInterval(async () => {
        const now = Date.now();

        let channels = client.channels?.cache.filter(
            c => c.isTextBased() && !c.isThread()
        ) as Collection<string, TextChannel>;
        
        if (channels.size === 0) {
            console.warn("⚠️ [TMY-Scheduler] client.channels.cache is empty! Executing active guild channel sync...");
            try {
                for (const [_, guild] of client.guilds.cache) {
                    await guild.channels.fetch();
                }
                channels = client.channels.cache.filter(
                    c => c.isTextBased() && !c.isThread()
                ) as Collection<string, TextChannel>;
                console.log(`✅ [TMY-Scheduler] Sync complete. Populated tracking matrix with ${channels.size} channels.`);
            } catch (fetchErr) {
                console.error("❌ [TMY-Scheduler] Failed to force-fetch base channels:", fetchErr);
            }
        }

        let scheduleThread: ThreadChannel | null = null;
        for (const [_, ch] of channels) {
            try {
                let found : ThreadChannel | undefined = ch.threads?.cache.find(t => t.name === 'tmy-schedules') as ThreadChannel | undefined;
                if (!found && ch.threads) {
                    const activeThreads = await ch.threads.fetchActive();
                    found = activeThreads.threads.find(t => t.name === 'tmy-schedules') as ThreadChannel | undefined;
                }

                if (found) {
                    scheduleThread = found as ThreadChannel;
                    console.log(`📍 [TMY-Scheduler] Located active configuration control room thread in: #${ch.name}`);
                    break;
                }
            } catch (e) {
                console.error(`❌ [TMY-Scheduler] Failed evaluating sub-threads inside channel #${ch.name}:`, e);
                continue;
            }
        }

        if (!scheduleThread) {
            console.log("❌ [TMY-Scheduler] Loop ended: Could not find an active 'tmy-schedules' thread in any readable context.");
            return; 
        }

        try {
            console.log(`📥 [TMY-Scheduler] Fetching configurations from thread: #${scheduleThread.name}...`);
            const messages = await scheduleThread.messages.fetch({ limit: 20 });

            const configMessages = messages.filter(m => m.content.includes('⚙️ **TMY AUTOMATION CONFIGURATION**'));
            console.log(`📝 [TMY-Scheduler] Discovered ${configMessages.size} configuration layouts to analyze.`);

            for (const [_, msg] of configMessages) {
                const text = msg.content;

                const srcId = text.match(/\[SRC:(\d+)\]/)?.[1];
                const dstId = text.match(/\[DST:(\d+)\]/)?.[1];
                const freq  = text.match(/\[FREQ:(.*?)\]/)?.[1];  // 'hourly' | 'daily' | 'weekly'
                const timeStr = text.match(/\[TIME:(.*?)\]/)?.[1] || "00:00"; // e.g. "12:00"
                const actionStr = text.match(/\[ACT:(.*?)\]/)?.[1];
                // const lastRun = parseInt(text.match(/\[RUN:(\d+)\]?/)?.[1] || text.match(/\[RUN:(\d+)\]/)?.[1] || "0");
                const runMatch = text.match(/\[RUN:(\d+)\]/)?.[1];
                const lastRun = runMatch ? parseInt(runMatch) : 0;

                if (!srcId || !dstId || !freq) {
                    console.warn(`⚠️ [TMY-Scheduler] Invalid arguments passed in config string. Skipping parsing for message ID: ${msg.id}`);
                    continue; // Safely bypasses corrupted config entries without breaking the system
                }

                let shouldTrigger = false;

                if (freq === 'hourly') {
                    const timeElapsed = now - lastRun;
                    if (timeElapsed >= ONE_HOUR_MS) {
                        shouldTrigger = true;
                    }
                } else if (freq === 'daily') {
                    const [targetHour, targetMinute] = timeStr.split(':').map(Number);
                    
                    const currentWorldDate = new Date(now);
                    const targetExecutionDate = new Date(now);
                    targetExecutionDate.setUTCHours(targetHour ?? 0, targetMinute ?? 0, 0, 0);
                    
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
                            
                            const randomLink = await getRandomTrackFromThread(playlistThread);
                            console.log(`🎲 Playlist ${randomLink} is picked.`);
                            if (!randomLink) {
                                console.warn(`⚠️ [TMY-Scheduler] Could not extract a valid playlist link string from thread: ${playlistThread.name}`);
                                continue;
                            }
                            const playlistId = extractPlaylistId(randomLink);
                            const randomTrack = await getRandomTrackFromPlaylist(playlistId!);

                            if (!randomTrack) {
                                await targetChannel.send(`⚠️ Scheduled event triggered, but I couldn't find any tracks inside the **#${playlistThread.name}** thread.`);
                                continue;
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
                        continue;
                    }

                    // Update Discord's "Database" entry message with the new run timestamp
                    let updatedText = text;
                    if (text.includes('[RUN:')) {
                        updatedText = text.replace(/\[RUN:\d+\]/, `[RUN:${now}]`);
                    } else {
                        updatedText = text + `\n[RUN:${now}]`;
                    }

                    updatedText = updatedText.replace(/\*Last updated: .*\*$/, `*Last updated: <t:${Math.floor(now / 1000)}:R>*`);
                    
                    await msg.edit(updatedText);
                    console.log(`✅ [TMY-Scheduler] Database config synced and updated to: [RUN:${now}]`);
                } else {
                    console.log(`⏳ [TMY-Scheduler] Timing metrics not crossed yet for config block: "${text.substring(0, 45)}..."`);
                }
            }
        } catch (error) {
            console.error("Scheduler loop execution encountered an error:", error);
        }
    }, 60000); // Ticks precisely every 60 seconds
}