// ===== DISCORD.JS SETUP =====
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
const db = require("./db.js");

// ===== CUSTOM TRIGGERS AND CONFIG =====
const {
  staffOnlyTriggers,
  dualRoleTriggers,
  userOnlyTriggers,
} = require("./triggerResponses.js");

const medals = ["🏆", "🧆", "🥇"];
const LEADERBOARD_CHANNEL_IDS = ["1400619519986241566"];

const VOUCHES_CHANNEL_ID = "1400619519986241566";
const STATUS_CHANNEL_ID = "1400619386964017314 && 1400623787816521949";
const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const TICKET_CATEGORY_ID = "1400611724884971550";
const OWNER_ID = "1400611712104927232";
const BLOCKED_CHANNEL_ID = "1400613438023270512"; // no-bot-commands channel

// ===== INITIALIZE DISCORD CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ===== LOAD SLASH AND TEXT COMMANDS =====
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

// ===== GIVEAWAY REACTION HANDLER =====
client.on(Events.MessageReactionAdd, (reaction, user) =>
  giveawayHandler.handleReaction(reaction, user, client)
);

// ===== INTERACTION COMMAND HANDLER =====
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`Error executing /${interaction.commandName}:`, err);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("❌ Something went wrong while running this command.");
      } else {
        await interaction.reply({ content: "❌ Something went wrong while running this command.", ephemeral: true });
      }
    } catch {}
  }
});


// ===== MESSAGE EVENT HANDLER =====
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.channel.id === BLOCKED_CHANNEL_ID) return;

  await vouchHandler.execute(message, client);
  await statusHandler.execute(message, client);

  // Legacy text commands (!command)
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

  // Trigger Responses
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

  // Triggers that respond to both staff and users
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

// ===== DAILY LEADERBOARD POSTER (10AM EST) =====
cron.schedule(
  "0 10 * * *",
  async () => {
    try {
      // Query top 10 users from database
      const { rows } = await db.query("SELECT * FROM points ORDER BY points DESC LIMIT 10");
      if (!rows.length) return;

      // Fetch usernames
      const userFetches = await Promise.all(
        rows.map((row) => client.users.fetch(row.user_id).catch(() => null))
      );

      // Format leaderboard
      let leaderboardText = "";
      rows.forEach(({ user_id, points }, index) => {
        const rank = medals[index] || `#${index + 1}`;
        leaderboardText += `${rank}  <@${user_id}>  —  **${points} pts**\n`;
      });

      // Use top user avatar or fallback to bot's
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

      // Post leaderboard to all defined channels
      for (const channelId of LEADERBOARD_CHANNEL_IDS) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) {
          await channel.send({ content: "@everyone", embeds: [embed] });
        }
      }

      console.log("[Leaderboard] Posted daily leaderboard at 10 AM EST to both channels.");
    } catch (err) {
      console.error("Failed to send daily leaderboard:", err);
    }
  },
  {
    timezone: "America/New_York",
  }
);

// ===== IMPORT OTHER EVENT HANDLERS =====
require("./events/ticketQueue.js")(client);
require("./events/completedTickets.js")(client);
require("./jobs/orderCountUpdater.js")(client); // <- add this

// ===== BOT LOGIN =====
client.login(process.env.TOKEN);
