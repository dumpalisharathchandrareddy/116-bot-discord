require("dotenv").config();

const { REST, Routes } = require("discord.js");

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("⏳ Clearing ALL GLOBAL slash commands...");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] }, // <--- Clears ALL commands
    );

    console.log("✅ All global slash commands cleared!");
  } catch (err) {
    console.error("❌ Failed to clear commands:", err);
  }
})();
