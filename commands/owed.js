const fs = require("fs");

module.exports = {
  name: "owed",
  description: "Show how much each user owes",
  async execute(message, args) {
    const staffRole = message.guild.roles.cache.find(
      (role) => role.name === "Staff",
    );

    if (!staffRole || !message.member.roles.cache.has(staffRole.id)) {
      return message.reply("❌ Only Staff can use this command.");
    }

    const owedFile = "./owed.json";
    if (!fs.existsSync(owedFile)) {
      return message.reply("No owed data found.");
    }

    const owed = JSON.parse(fs.readFileSync(owedFile));
    if (Object.keys(owed).length === 0) {
      return message.reply("No one owes anything yet.");
    }

    let reply = "💰 **Amounts Owed:**\n";
    for (const userId in owed) {
      reply += `<@${userId}> — **$${owed[userId].total}** (${owed[userId].orders} orders)\n`;
    }

    message.channel.send(reply);
  },
};
