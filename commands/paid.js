const fs = require("fs");

const OWNER_ID = "666746569193816086"; // Only YOU can run this

module.exports = {
  name: "paid",
  description: "Reset owed balance for a user",
  async execute(message, args) {
    if (message.author.id !== OWNER_ID) {
      return message.reply("❌ Only the bot owner can use this command.");
    }

    const mentioned = message.mentions.users.first();
    const method = args.slice(1).join(" ") || "unspecified method";

    if (!mentioned) {
      return message.reply("❌ Please mention the user who paid.");
    }

    const owedFile = "./owed.json";
    let owed = {};
    if (fs.existsSync(owedFile)) {
      owed = JSON.parse(fs.readFileSync(owedFile));
    }

    if (!owed[mentioned.id]) {
      return message.reply("That user doesn't owe anything.");
    }

    delete owed[mentioned.id];
    fs.writeFileSync(owedFile, JSON.stringify(owed, null, 2));

    message.channel.send(
      `✅ Cleared owed balance for <@${mentioned.id}> (Paid via **${method}**).`,
    );
  },
};
