if (process.env.NODE_ENV !== 'PROD') {
    require('dotenv').config();
}

const Discord = require('discord.js');
const config = { TOKEN: process.env.TOKEN };
const modules = require('./modules.json');

const client = new Discord.Client();
let hasBeenInitialized = false;

let invitesCount = {};
const channelNameToRoleNameMap = new Map([['37111-acg', '37111-acg']]);

const moduleRoleNames = modules.map((module) => {
    const [num, name] = module;
    const abbrevName = name
        .toLowerCase()
        .split(' ')
        .map((x) => x[0])
        .join('');
    return `${num}-${abbrevName}`;
});

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const guild = client.guilds.cache.first();
    await guild
        .fetchInvites()
        .then((invites) =>
            invites.each((invite) => (invitesCount[invite.code] = invite.uses))
        );
    console.log('Invites count:', invitesCount);
});

client.on('inviteCreate', invite => {
    console.log(`New invite created with code ${invite.code}`);
    invitesCount[invite.code] = invite.uses;
    console.log('Invites count updated.\nInvites count:', invitesCount);
});

client.on('inviteDelete', invite => {
    console.log(`Invite deleted with code ${invite.code}`);
    delete invitesCount[invite.code];
    console.log('Invites count updated.\nInvites count:', invitesCount);
})

client.on('guildMemberAdd', async (member) => {
    // console.log(`Triggered member add of member ${member.user.tag}`);
    // const invites = await member.guild.fetchInvites();
    // const newInvitesCount = invites.reduce(
    //     (acc, curr) => (acc[curr.code] = curr.uses),
    //     {}
    // );
    // for (code in invitesCount) {
    //     if (
    //         invitesCount[code] !== newInvitesCount[code] &&
    //         channelNameToRoleNameMap.has(invites.get(code).channel.name)
    //     ) {
    //         const roleName = channelNameToRoleNameMap.get(
    //             invites.get(code).channel.name
    //         );
    //         await member.roles
    //             .add(
    //                 member.guild.roles.cache.find(
    //                     (role) => role.name === roleName
    //                 )
    //             )
    //             .then((_member) =>
    //                 console.log(`Role ${roleName} added to ${_member.user.tag}`)
    //             );
    //             break;
    //     }
    // }
    // invitesCount = newInvitesCount;
    // console.log('Invites count updated, invites count:', invitesCount);
});

client.on('message', async msg => {
    if (msg.channel.name === 'bot-testing') {
        if (msg.content === '!refresh-invites-count') {
            console.log('Refreshing invites count');
            const invites = await msg.guild.fetchInvites();
            invitesCount = invites.reduce(
                (acc, curr) => (acc[curr.code] = curr.uses),
                {}
            );
            console.log('Invites count updated.\nInvites count:', invitesCount);
            msg.react('✅');
            msg.channel.send("```"+JSON.stringify(invitesCount, undefined, 2)+"```");
            return;
        }

        if (msg.content === '!get-invites-count') {
            msg.channel.send("```"+JSON.stringify(invitesCount, undefined, 2)+"```");
        }

    }
})

client.on('message', async (msg) => {
    if (
        msg.member.hasPermission('ADMINISTRATOR') &&
        msg.channel.name === 'subscribe-units' &&
        msg.content === 'init' &&
        !hasBeenInitialized
    ) {
        const sem1Category = msg.guild.channels.cache.find(
            (c) => c.name === 'Semester 1' && c.type === 'category'
        );
        const sem2Category = msg.guild.channels.cache.find(
            (c) => c.name === 'Semester 2' && c.type === 'category'
        );
        const everyoneRole = msg.guild.roles.cache.find(
            (r) => r.name === '@everyone'
        );

        console.log('Sending module info');
        await msg.channel.send(
            'Please type in the module code from the chat bellow to be enrolled to channel for that module'
        );
        await msg.channel.send(
            `\`\`\`${modules.map((x) => x.join(' - ')).join('\n')}\`\`\``
        );
        console.log('Sent module info');

        console.log('Adding roles');
        moduleRoleNames.map(
            async (name) =>
                await msg.guild.roles
                    .create({ data: { name, mentionable: true } })
                    .then((role) => {
                        console.log(`Added ${role.name} role`);
                        return role;
                    })
                    .then((role) => {
                        const category = role.name.slice(0, 5).endsWith('2')
                            ? sem2Category
                            : sem1Category;
                        const [num, name] = modules.find(
                            (m) => m[0] === role.name.slice(0, 5)
                        );
                        return msg.guild.channels.create(role.name, {
                            type: 'text',
                            parent: category,
                            topic: `${num} - ${name}`,
                            permissionOverwrites: [
                                { id: role, allow: 'VIEW_CHANNEL' },
                                { id: everyoneRole, deny: 'VIEW_CHANNEL' },
                            ],
                        });
                    })
                    .then((channel) => {
                        console.log(`${channel.name} channel has been created`);
                        return channel;
                    })
        );
        console.log('Added all roles');

        hasBeenInitialized = true;
        await msg.delete({ timeout: 1000 });
        return;
    }
});

client.on('message', async (msg) => {
    if (msg.channel.name === 'subscribe-units' && !msg.author.bot) {
        const moduleMatches = moduleRoleNames.filter((name) =>
            name.startsWith(msg.content)
        );
        if (moduleMatches.length === 1) {
            const [roleName] = moduleMatches;
            const role = msg.guild.roles.cache.find((r) => r.name === roleName);

            if (msg.member.roles.cache.has(role.id)) {
                await msg.member.roles.remove(role);
                await msg.react('❌');
            } else {
                await msg.member.roles.add(role);
                await msg.react('✅');
            }
        } else {
            await msg.react('⚠️');
        }
        await msg.delete({ timeout: 1000 });
    }
});

client.on('message', async (msg) => {
    if (
        msg.content === 'reset' &&
        msg.member.hasPermission('ADMINISTRATOR') &&
        msg.channel.name === 'subscribe-units'
    ) {
        const name = msg.channel.name;
        await msg.channel.delete();
        await msg.guild.channels.create(name);
        msg.guild.roles.cache.forEach(
            async (role) =>
                await role.delete().catch(`${role.name} was not deleted`)
        );
        msg.guild.channels.cache
            .filter((c) => {
                return (
                    c.type === 'category' &&
                    (c.name === 'Semester 1' || c.name === 'Semester 2')
                );
            })
            .forEach((cat) => cat.children.forEach((c) => c.delete()));
    }
});

client.on('message', async (msg) => {
    if (
        msg.member.hasPermission('ADMINISTRATOR') &&
        msg.channel.name === 'subscribe-units' &&
        msg.content === 'resend'
    ) {
        await msg.channel.send(
            'Please type in the module code from the chat bellow to be enrolled to channel for that module'
        );
        await msg.channel.send(
            `\`\`\`${modules.map((x) => x.join(' - ')).join('\n')}\`\`\``
        );

        await msg.delete({ timeout: 1000 });
    }
});

client.login(config.TOKEN);
