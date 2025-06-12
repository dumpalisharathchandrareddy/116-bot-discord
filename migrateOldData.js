const fs = require("fs");
const pool = require("./db");

async function resetTables() {
  console.log("🧨 Dropping existing tables...");
  await pool.query(`
    DROP TABLE IF EXISTS
      giveaway_state,
      giveaway_entries,
      completed_tickets,
      owed,
      referrals,
      points
    CASCADE;
  `);
  console.log("✅ Tables dropped");
}

async function createTables() {
  console.log("📦 Recreating tables...");
  await pool.query(`
    CREATE TABLE points (
      user_id TEXT PRIMARY KEY,
      points INTEGER DEFAULT 0
    );

    CREATE TABLE referrals (
      user_id TEXT PRIMARY KEY,
      referred_by TEXT,
      referral_count INTEGER DEFAULT 0
    );

    CREATE TABLE owed (
      user_id TEXT PRIMARY KEY,
      amount NUMERIC(10, 2) DEFAULT 0,
      orders INTEGER DEFAULT 0
    );

    CREATE TABLE completed_tickets (
      ticket_id TEXT PRIMARY KEY,
      completed_at BIGINT
    );

    CREATE TABLE giveaway_entries (
      user_id TEXT PRIMARY KEY,
      entries INTEGER DEFAULT 0
    );

    CREATE TABLE giveaway_state (
      id SERIAL PRIMARY KEY,
      message_id TEXT,
      channel_id TEXT,
      is_active BOOLEAN,
      prize TEXT,
      ends_at TIMESTAMP
    );
  `);
  console.log("✅ Tables created");
}

async function migrateData() {
  const points = JSON.parse(fs.readFileSync("./points.json"));
  const referrals = JSON.parse(fs.readFileSync("./referrals.json"));
  const owed = JSON.parse(fs.readFileSync("./owed.json"));
  const completedTickets = JSON.parse(fs.readFileSync("./completed_tickets.json"));
  const giveawayEntries = JSON.parse(fs.readFileSync("./giveaway_entries.json", "utf8") || "[]");
  const giveawayState = JSON.parse(fs.readFileSync("./giveaway_state.json", "utf8") || "{}");

  // ➤ Points
  for (const [userId, value] of Object.entries(points)) {
    await pool.query(`
      INSERT INTO points (user_id, points)
      VALUES ($1, $2)
    `, [userId, value]);
  }
  console.log("✅ points.json migrated");

  // ➤ Referrals
  for (const [userId, referredBy] of Object.entries(referrals)) {
    await pool.query(`
      INSERT INTO referrals (user_id, referred_by, referral_count)
      VALUES ($1, $2, 1)
    `, [userId, referredBy]);
  }
  console.log("✅ referrals.json migrated");

  // ➤ Owed
  for (const [userId, value] of Object.entries(owed)) {
    const amount = typeof value === "object" ? value.amount || 0 : value;
    const orders = typeof value === "object" ? value.orders || 0 : 0;
    await pool.query(`
      INSERT INTO owed (user_id, amount, orders)
      VALUES ($1, $2, $3)
    `, [userId, amount, orders]);
  }
  console.log("✅ owed.json migrated");

  // ➤ Completed Tickets
  for (const [ticketId, timestamp] of Object.entries(completedTickets)) {
    await pool.query(`
      INSERT INTO completed_tickets (ticket_id, completed_at)
      VALUES ($1, $2)
    `, [ticketId, timestamp]);
  }
  console.log("✅ completed_tickets.json migrated");

  // ➤ Giveaway Entries
  if (Array.isArray(giveawayEntries)) {
    for (const entry of giveawayEntries) {
      if (typeof entry === "string") {
        await pool.query(`
          INSERT INTO giveaway_entries (user_id, entries)
          VALUES ($1, $2)
        `, [entry, 1]);
      } else if (typeof entry === "object") {
        await pool.query(`
          INSERT INTO giveaway_entries (user_id, entries)
          VALUES ($1, $2)
        `, [entry.userId, entry.entries || 1]);
      }
    }
  }
  console.log("✅ giveaway_entries.json migrated");

  // ➤ Giveaway State
  if (giveawayState && typeof giveawayState === "object" && Object.keys(giveawayState).length > 0) {
    const {
      messageId,
      channelId,
      isActive = false,
      prize = "NO SERVICE FEE Order",
      endsAt = null
    } = giveawayState;

    await pool.query(`
      INSERT INTO giveaway_state (message_id, channel_id, is_active, prize, ends_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [messageId || null, channelId || null, isActive, prize, endsAt ? new Date(endsAt) : null]);

    console.log("✅ giveaway_state.json migrated");
  } else {
    console.log("⚠️ No giveaway_state.json data found or it's empty.");
  }
}

async function main() {
  try {
    await resetTables();
    await createTables();
    await migrateData();
    console.log("🎉 Full migration complete!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    process.exit();
  }
}

main();
