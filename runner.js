const { spawn } = require("child_process");

function runBot() {
  const process = spawn("node", ["bot.js"], { stdio: "inherit" });

  process.on("close", (code) => {
    console.log(`❌ Bot exited with code ${code}. Restarting in 3 seconds...`);
    setTimeout(runBot, 3000);
  });

  process.on("error", (err) => {
    console.error("Failed to start bot:", err);
    setTimeout(runBot, 3000);
  });
}

runBot();
