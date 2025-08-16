// lib/dmContent.js
const db = require("../db");

/**
 * Fetch DM template for a channel.
 * @param {string} channelId
 * @returns {Promise<{title:string,color:number,body:string}|null>}
 */
async function getForChannel(channelId) {
  const { rows } = await db.query(
    "SELECT title, color, body FROM dm_channel_content WHERE channel_id = $1",
    [channelId]
  );
  return rows[0] || null;
}

/**
 * Upsert DM template for a channel.
 * Any undefined field keeps its previous value (if row exists) or uses a default.
 * @param {string} channelId
 * @param {{title?:string,color?:number,body?:string}} data
 */
async function setForChannel(channelId, { title, color, body }) {
  // NOTE: color must be an integer (e.g. 5793266 for #5865F2). Pass null/undefined to keep current.
  const { rows } = await db.query(
    `INSERT INTO dm_channel_content (channel_id, title, color, body)
     VALUES ($1, COALESCE($2,'📩 Info'), COALESCE($3,5793266), COALESCE($4,''))
     ON CONFLICT (channel_id) DO UPDATE SET
       title = COALESCE($2, dm_channel_content.title),
       color = COALESCE($3, dm_channel_content.color),
       body  = COALESCE($4, dm_channel_content.body),
       updated_at = NOW()
     RETURNING channel_id`,
    [channelId, title ?? null, Number.isInteger(color) ? color : null, body ?? null]
  );
  return rows[0];
}

/**
 * Delete the row for a channel (used by /setdm reset).
 * @param {string} channelId
 */
async function resetChannel(channelId) {
  await db.query("DELETE FROM dm_channel_content WHERE channel_id = $1", [channelId]);
}

module.exports = { getForChannel, setForChannel, resetChannel };
