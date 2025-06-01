require("dotenv").config();

const { REST, Routes } = require("discord.js");
const { readdirSync } = require("fs");

const CLIENT_ID = process.env.CLIENT_ID; // your bot's client ID
const GUILD_ID = process.env.GUILD_ID; // your server ID (for testing fast updates!)

const commands = [];

const commandFiles = readdirSync("./commands");
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (command.data && command.data.name) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(
      `⏳ Started refreshing application (/) commands for guild ${GUILD_ID}...`,
    );

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), // deploy to your server
      { body: commands },
    );

    console.log("✅ Successfully reloaded (/) commands!");
  } catch (error) {
    console.error(error);
  }
})();
