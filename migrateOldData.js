const fs = require("fs");
const pool = require("./db");

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS points (
      user_id TEXT PRIMARY KEY,
      points INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS referrals (
      user_id TEXT PRIMARY KEY,
      referred_by TEXT,
      referral_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS owed (
      user_id TEXT PRIMARY KEY,
      amount NUMERIC DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS completed_tickets (
      ticket_id TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS giveaway_entries (
      user_id TEXT PRIMARY KEY,
      entries INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS giveaway_state (
      id SERIAL PRIMARY KEY,
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
  const completedTickets = JSON.parse(fs.readFileSync("./completed_tickets.json"));
  const giveawayEntries = JSON.parse(fs.readFileSync("./giveaway_entries.json", "utf8") || "[]");

  for (const [userId, pointsValue] of Object.entries(points)) {
    await pool.query(`
      INSERT INTO points (user_id, points)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET points = EXCLUDED.points
    `, [userId, pointsValue]);
  }

  for (const [userId, info] of Object.entries(referrals)) {
    await pool.query(`
      INSERT INTO referrals (user_id, referred_by, referral_count)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET referred_by = EXCLUDED.referred_by, referral_count = EXCLUDED.referral_count
    `, [userId, info.referredBy || null, info.referralCount || 0]);
  }

  for (const ticketId of completedTickets) {
    await pool.query(`
      INSERT INTO completed_tickets (ticket_id)
      VALUES ($1)
      ON CONFLICT (ticket_id) DO NOTHING
    `, [ticketId]);
  }

  for (const entry of giveawayEntries) {
    await pool.query(`
      INSERT INTO giveaway_entries (user_id, entries)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET entries = EXCLUDED.entries
    `, [entry.userId, entry.entries]);
  }

  console.log("✅ Data migrated.");
}

async function main() {
  try {
    await createTables();
    await migrateData();
    console.log("🎉 Migration finished!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    process.exit();
  }
}

main();
