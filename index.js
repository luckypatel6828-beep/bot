const { Client } = require('discord.js-selfbot-v13');
const { joinVoiceChannel } = require('@discordjs/voice');
const cron = require('node-cron');
const moment = require('moment-timezone'); // Adding this to easily check the current time!

const TARGET_VC_ID = '1467025697758511287';

// LO's regional self-bot configs!
const botConfigs = [
    {
        name: "Brazil",
        token: "MTUxNzk1MDAwMzYyMjk3MzY0Nw.GT6hn6.7_5EbvbTHoIss6NaP1vgp8THNxMJsOp5egkKNA",
        timezone: "America/Sao_Paulo", // Brazil timezone
        loginTime: "08:00",
        logoutTime: "17:00" // 5 PM
    },
    {
        name: "MENA",
        token: "MTQ2OTMyMjM0ODU0NDAwNDEwNg.GbkKUA.imP6X5aqqUrPuqNFvV5u2HjiRRFxq0YI9c7byY",
        timezone: "Asia/Riyadh", // Saudi Arabia / MENA timezone
        loginTime: "08:00",
        logoutTime: "17:00" // 5 PM
    }
];

console.log(`[*] Loading region-specific schedules for LO...`);

botConfigs.forEach(config => {
    let client = null;
    let isActiveShift = false;

    const [loginHour, loginMinute] = config.loginTime.split(':');
    const [logoutHour, logoutMinute] = config.logoutTime.split(':');
    
    const loginCron = `${loginMinute} ${loginHour} * * *`;
    const logoutCron = `${logoutMinute} ${logoutHour} * * *`;

    function forceJoinVC() {
        if (!client || !isActiveShift) return;
        const channel = client.channels.cache.get(TARGET_VC_ID);
        if (channel) {
            joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfMute: true,
                selfDeaf: false,
            });
            console.log(`[+] ${config.name} successfully joined the VC!`);
        } else {
            console.log(`[-] ${config.name} could not find the VC. Is it in the server?`);
        }
    }

    function startBotShift(reason) {
        if (isActiveShift) return; // Already active
        console.log(`\n[+] ${reason} Waking up ${config.name}...`);
        isActiveShift = true;
        
        client = new Client({ checkUpdate: false });
        
        client.on('ready', () => {
            console.log(`[+] ${config.name} logged in as ${client.user.tag}`);
            forceJoinVC();
        });

        client.on('voiceStateUpdate', (oldState, newState) => {
            if (oldState.member && oldState.member.user.id === client.user.id) {
                if (oldState.channelId && !newState.channelId) {
                    if (isActiveShift) {
                        console.log(`[!] ${config.name} was disconnected! Rejoining in 3 seconds...`);
                        setTimeout(forceJoinVC, 3000); 
                    }
                }
            }
        });

        client.login(config.token).catch(err => {
            console.error(`[-] Failed to login token for ${config.name}`, err);
        });
    }

    function endBotShift(reason) {
        if (!isActiveShift) return;
        console.log(`\n[-] ${reason} Shift ended for ${config.name}. Logging off...`);
        isActiveShift = false;
        if (client) {
            client.destroy();
            client = null;
        }
    }

    // --- NEW LOGIC: Check if they should be online RIGHT NOW ---
    const currentTimeInRegion = moment().tz(config.timezone);
    const loginMoment = moment.tz(`${currentTimeInRegion.format('YYYY-MM-DD')} ${config.loginTime}`, "YYYY-MM-DD HH:mm", config.timezone);
    const logoutMoment = moment.tz(`${currentTimeInRegion.format('YYYY-MM-DD')} ${config.logoutTime}`, "YYYY-MM-DD HH:mm", config.timezone);

    if (currentTimeInRegion.isBetween(loginMoment, logoutMoment)) {
        console.log(`[*] Catch-up check: It is currently ${currentTimeInRegion.format('HH:mm')} in ${config.timezone}. ${config.name} should be online!`);
        startBotShift(`Catching up!`);
    }

    // 1. Schedule Login
    cron.schedule(loginCron, () => {
        startBotShift(`Clock hit ${config.loginTime} in ${config.timezone}!`);
    }, { timezone: config.timezone });

    // 2. Schedule Logout
    cron.schedule(logoutCron, () => {
        endBotShift(`Clock hit ${config.logoutTime} in ${config.timezone}.`);
    }, { timezone: config.timezone });
    
    console.log(`[SCHEDULED] ${config.name} Bot: 8:00 AM to 5:00 PM (${config.timezone})`);
});

console.log(`\n[*] All regional schedules loaded and active!`);
