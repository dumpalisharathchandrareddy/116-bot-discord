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
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.points = {};
try {
  client.points = JSON.parse(
    fs.readFileSync(path.join(__dirname, "points.json")),
  );
} catch (err) {
  console.error("Failed to load points.json:", err);
}

client.commands = new Collection();

const commandFiles = fs.readdirSync("./commands");
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);

  // If it is a Slash command (/completed etc)
  if (command.data && command.data.name) {
    client.commands.set(command.data.name, command);
  }
  // If it is a message command (!owed, !paid)
  else if (command.name) {
    client.commands.set(command.name, command);
  }
}

client.once(Events.ClientReady, () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
});

// Load handlers
const vouchHandler = require("./events/vouchHandler.js");
const statusHandler = require("./events/statusHandler.js");

// Interaction (slash command) handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (command) await command.execute(interaction, client);
});

// FULL MessageCreate listener
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.channel.id === BLOCKED_CHANNEL_ID) return;

  // ----- Vouch Handler -----
  await vouchHandler.execute(message, client);

  // ----- Status Handler -----
  await statusHandler.execute(message, client);

  // ----- Giveaway Handler -----
  const giveawayHandler = require("./events/giveawayHandler.js");

  client.on("messageReactionAdd", (reaction, user) =>
    giveawayHandler.handleReaction(reaction, user, client),
  );

  // ----- Message Commands (!owed, !paid, !reset etc) -----
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

  // ----- Staff/User Triggers -----
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

// Auto-leaderboard
cron.schedule(
  "0 10 * * *",
  async () => {
    try {
      const points = JSON.parse(fs.readFileSync(pointsFile, "utf-8"));
      const sorted = Object.entries(points)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      if (sorted.length === 0) return; // nothing to send

      const userFetches = await Promise.all(
        sorted.map(([userId]) => client.users.fetch(userId).catch(() => null)),
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
        const channel = await client.channels
          .fetch(channelId)
          .catch(() => null);
        if (channel) {
          await channel.send({ content: "@everyone", embeds: [embed] });
        }
      }

      console.log(
        "[Leaderboard] Posted daily leaderboard at 10 AM EST to both channels.",
      );
    } catch (err) {
      console.error("Failed to send daily leaderboard:", err);
    }
  },
  {
    timezone: "America/New_York",
  },
);

// Messager queue and time
client.on("channelCreate", async (channel) => {
  const TICKET_CATEGORY_ID = "1374661309140045825";
  if (!channel.name.startsWith("ticket-")) return;
  if (!channel.guild || channel.parentId !== TICKET_CATEGORY_ID) return;

  setTimeout(async () => {
    const openTickets = channel.guild.channels.cache.filter(
      (c) => c.parentId === TICKET_CATEGORY_ID && c.name.startsWith("ticket-"),
    );

    const sortedTicketsArray = openTickets
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .toJSON();

    const position =
      sortedTicketsArray.findIndex((c) => c.id === channel.id) + 1;
    const estimatedWait = position * 4;

    const embed = new EmbedBuilder()
      .setTitle("🎟️ Ticket Queue Info")
      .setDescription(
        `⏳ You are **#${position}** in line.\n` +
          `**Estimated wait:** \`${estimatedWait} minutes\`\n\n` +
          `Please be patient, our staff will assist you as soon as possible!\n\n` +
          `> If you have urgent info, please add it here!`,
      )
      .setColor(0x5865f2)
      .setFooter({ text: "Thank you for ordering from 116's UE!" })
      .setTimestamp();

    await channel.send({
      content: `<@${OWNER_ID}>`,
      embeds: [embed],
    });

    await channel.send(
      "📦 **Please send your cart link here in the chat and also mention your city!** 🏙️",
    );
  }, 5000);
});

// Auto-delete completed tickets
const COMPLETED_CATEGORY_ID = "1374659946603483136";
const YOUR_GUILD_ID = "1369186844268433488";
const completedTicketsFile = path.join(__dirname, "completed_tickets.json");

client.once("ready", async () => {
  let completedData = {};
  try {
    completedData = JSON.parse(fs.readFileSync(completedTicketsFile, "utf-8"));
  } catch {
    completedData = {};
  }

  const guild = await client.guilds.fetch(YOUR_GUILD_ID);
  const now = Date.now();

  guild.channels.cache.forEach(async (channel) => {
    if (
      channel.parentId === COMPLETED_CATEGORY_ID &&
      channel.name.startsWith("ticket-")
    ) {
      const movedAt = completedData[channel.id];
      if (movedAt) {
        const msSinceMoved = now - movedAt;
        const msLeft = 2.5 * 60 * 60 * 1000 - msSinceMoved;
        if (msLeft <= 0) {
          await channel.send("🗑️ Deleting this completed ticket channel now.");
          await channel.delete(
            "Auto-deleted after 2.5 hours in completed category",
          );
        } else {
          setTimeout(async () => {
            try {
              await channel.send(
                "🗑️ Deleting this completed ticket channel now.",
              );
              await channel.delete(
                "Auto-deleted after 2.5 hours in completed category",
              );
            } catch (e) {}
          }, msLeft);
        }
      }
    }
  });
});

client.on("channelUpdate", async (oldChannel, newChannel) => {
  if (
    newChannel.type === 0 &&
    oldChannel.parentId !== COMPLETED_CATEGORY_ID &&
    newChannel.parentId === COMPLETED_CATEGORY_ID &&
    newChannel.name.startsWith("ticket-")
  ) {
    let completedData = {};
    try {
      completedData = JSON.parse(
        fs.readFileSync(completedTicketsFile, "utf-8"),
      );
    } catch {
      completedData = {};
    }
    completedData[newChannel.id] = Date.now();
    fs.writeFileSync(
      completedTicketsFile,
      JSON.stringify(completedData, null, 2),
    );

    await newChannel.send(
      "✅ This ticket has been marked as completed. This channel will be **automatically deleted in 2.5 hours**. Thank you!",
    );

    setTimeout(
      async () => {
        try {
          await newChannel.send(
            "🗑️ Deleting this completed ticket channel now.",
          );
          await newChannel.delete(
            "Auto-deleted after 2.5 hours in completed category",
          );
          let cd = {};
          try {
            cd = JSON.parse(fs.readFileSync(completedTicketsFile, "utf-8"));
          } catch {
            cd = {};
          }
          delete cd[newChannel.id];
          fs.writeFileSync(completedTicketsFile, JSON.stringify(cd, null, 2));
        } catch (e) {}
      },
      2.5 * 60 * 60 * 1000,
    );
  }
});

client.login(process.env.TOKEN);
