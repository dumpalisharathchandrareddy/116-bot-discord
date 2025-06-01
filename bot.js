const {
  Client,
  GatewayIntentBits,
  Events,
  Partials,
  Collection,
  EmbedBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const cron = require("node-cron");

const {
  staffOnlyTriggers,
  dualRoleTriggers,
  userOnlyTriggers,
} = require("./triggerResponses.js");

const pointsFile = "./points.json";
const medals = ["🥇", "🥈", "🥉"];
const LEADERBOARD_CHANNEL_IDS = ["1369199837643542528", "1371930116720169181"];

const VOUCHES_CHANNEL_ID = "1369199837643542528";
const STATUS_CHANNEL_ID = "1369199414077554749";
const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const TICKET_CATEGORY_ID = "1374661309140045825";
const OWNER_ID = "666746569193816086";
const BLOCKED_CHANNEL_ID = "1371930116720169181";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.points = {};
try {
  client.points = JSON.parse(
    fs.readFileSync(path.join(__dirname, "points.json"))
  );
} catch (err) {
  console.error("Failed to load points.json:", err);
}

client.commands = new Collection();

const commandFiles = fs.readdirSync("./commands");
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);

  if (command.data && command.data.name) {
    client.commands.set(command.data.name, command);
  } else if (command.name) {
    client.commands.set(command.name, command);
  }
}

// ===== READY EVENT =====
client.once(Events.ClientReady, () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
});

// ===== LOAD HANDLERS =====
const vouchHandler = require("./events/vouchHandler.js");
const statusHandler = require("./events/statusHandler.js");
const giveawayHandler = require("./events/giveawayHandler.js");

// ===== CORRECT: ONLY ONE GLOBAL REACTION LISTENER =====
client.on(Events.MessageReactionAdd, (reaction, user) =>
  giveawayHandler.handleReaction(reaction, user, client)
);

// ===== INTERACTION HANDLER =====
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (command) await command.execute(interaction, client);
});

// ===== MESSAGECREATE HANDLER =====
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.channel.id === BLOCKED_CHANNEL_ID) return;

  // Vouch Handler
  await vouchHandler.execute(message, client);

  // Status Handler
  await statusHandler.execute(message, client);

  // Message Commands (!owed, !paid, !reset etc)
  if (message.content.startsWith("!")) {
    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
      await command.execute(message, args, client);
    } catch (err) {
      console.error(err);
      await message.reply("❌ An error occurred while executing the command.");
    }
    return;
  }

  // Staff/User Triggers
  const content = message.content.toLowerCase();
  const member = await message.guild?.members
    .fetch(message.author.id)
    .catch(() => null);
  const isStaff = !!(member && member.roles.cache.has(STAFF_ROLE_ID));
  const isTicket = message.channel.parentId === TICKET_CATEGORY_ID;

  // Staff-only triggers
  if (isStaff) {
    for (const trigger in staffOnlyTriggers) {
      if (content.includes(trigger)) {
        message.reply(staffOnlyTriggers[trigger]);
        return;
      }
    }
  }

  // Dual triggers
  for (const trigger in dualRoleTriggers) {
    if (content.includes(trigger)) {
      if (isStaff) {
        message.reply(dualRoleTriggers[trigger].staff);
      } else if (isTicket) {
        message.reply(dualRoleTriggers[trigger].user);
      }
      return;
    }
  }

  // User-only triggers
  if (!isStaff && isTicket) {
    for (const trigger in userOnlyTriggers) {
      if (content.includes(trigger)) {
        message.reply(userOnlyTriggers[trigger]);
        return;
      }
    }
  }
});

// ===== AUTO-LEADERBOARD CRON =====
cron.schedule(
  "0 10 * * *",
  async () => {
    try {
      const points = JSON.parse(fs.readFileSync(pointsFile, "utf-8"));
      const sorted = Object.entries(points)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      if (sorted.length === 0) return;

      const userFetches = await Promise.all(
        sorted.map(([userId]) => client.users.fetch(userId).catch(() => null))
      );

      let leaderboardText = "";
      sorted.forEach(([userId, pts], index) => {
        const rank = medals[index] || `#${index + 1}`;
        const mention = `<@${userId}>`;
        leaderboardText += `${rank}  ${mention}  —  **${pts} pts**\n`;
      });

      const topUser = userFetches[0];
      const avatarUrl =
        topUser?.displayAvatarURL({ size: 256 }) ||
        client.user.displayAvatarURL({ size: 256 });

      const embed = new EmbedBuilder()
        .setTitle("🏆 Points Leaderboard")
        .setDescription(leaderboardText)
        .setColor(0xffd700)
        .setThumbnail(avatarUrl)
        .setFooter({ text: "Top 10 users by points | 116 bot" });

      for (const channelId of LEADERBOARD_CHANNEL_IDS) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) {
          await channel.send({ content: "@everyone", embeds: [embed] });
        }
      }

      console.log(
        "[Leaderboard] Posted daily leaderboard at 10 AM EST to both channels."
      );
    } catch (err) {
      console.error("Failed to send daily leaderboard:", err);
    }
  },
  {
    timezone: "America/New_York",
  }
);

// ===== REST OF YOUR EVENTS (NO CHANGE NEEDED) =====
require("./events/ticketQueue.js")(client);
require("./events/completedTickets.js")(client);

// ===== LOGIN =====
client.login(process.env.TOKEN);
