const Discord = require('discord.js');
const fs = require('fs');
const parser = require('./parser');
const configTracker = require('./configtracker');
const modules = fs.readdirSync('./modules');

const client = new Discord.Client();
const dispatch = new parser();
const config = new configTracker();
const context = {dispatch, config, client};

client.on('error', (error) => {
    console.error(new Date() + ": Discord client encountered an error");
    console.error(error);
})

client.once('ready', async () => {
    console.log('Starting bot...');
    for (const moduleName of modules) {
        const Module = require('./modules/' + moduleName);
        const testModule = new Module(context);
    }
})

client.on('message', (msg) => {
    dispatch.informModules(msg);
});

client.login(config.get('bot-token'));  