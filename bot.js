const { timeStamp } = require('console');
const Discord = require('discord.js');
const config = require('./config.json');
const modules = require('./modules.json');

const client = new Discord.Client();
const guild = new Discord.Guild(client);
let hasBeenInitialized = false;

const sem1Modules = modules.filter((module) => module[0].endsWith('1'));
const sem2Modules = modules.filter((module) => module[0].endsWith('2'));

const moduleRoleNames = modules.map((module) => {
    const [num, name] = module;
    const abbrevName = name
        .toLowerCase()
        .split(' ')
        .map((x) => x[0])
        .join('');
    return `${num}-${abbrevName}`;
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

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
                        return msg.guild.channels.create(role.name, {
                            type: 'text',
                            parent: category,
                            permissionOverwrites: [
                                { id: role, allow: 'VIEW_CHANNEL' },
                                { id: everyoneRole, deny: 'VIEW_CHANNEL' },
                            ],
                        });
                    })
                    .then((channel) => {})
        );
        console.log('Added all roles');

        hasBeenInitialized = true;
        msg.delete({ timeout: 1000 });
        return;
    }
});

client.on('message', (msg) => {
    const moduleMatches = moduleRoleNames.filter((name) =>
        name.startsWith(msg.content)
    );
    if (moduleMatches.length === 1) {
        msg.react('✅');

        const [roleName] = moduleMatches;
        const role = msg.guild.roles.cache.find((r) => r.name === roleName);
        msg.member.roles.add(role);

        msg.delete({ timeout: 1000 });
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

client.login(config.TOKEN);
