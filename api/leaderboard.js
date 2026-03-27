const NEON_HOST = process.env.NEON_HOST;
const NEON_USER = process.env.NEON_USER;
const NEON_PASS = process.env.NEON_PASS;
const NEON_DB   = process.env.NEON_DB || 'neondb';

if (!NEON_HOST || !NEON_USER || !NEON_PASS) {
  console.error('Missing Neon env vars: NEON_HOST, NEON_USER, NEON_PASS must be set');
}

async function neonQuery(query, params = []) {
  const connStr = `postgresql://${NEON_USER}:${NEON_PASS}@${NEON_HOST}/${NEON_DB}?sslmode=require`;
  const res = await fetch(`https://${NEON_HOST}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type':           'application/json',
      'Neon-Connection-String': connStr,
      'Neon-Password':          NEON_PASS,
    },
    body: JSON.stringify({ query, params }),
  });
  if (!res.ok) throw new Error(`Neon error ${res.status}: ${await res.text()}`);
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!NEON_HOST || !NEON_USER || !NEON_PASS) {
    return res.status(500).json({ error: 'Server misconfigured: missing Neon env vars' });
  }

  try {
    if (req.method === 'GET') {
      const { searchParams } = new URL(req.url, 'http://localhost');
      const puzzle_id = searchParams.get('puzzle_id');
      if (!puzzle_id) return res.status(400).json({ error: 'Missing puzzle_id' });

      const result = await neonQuery(
        'SELECT player_name, time_seconds FROM leaderboard WHERE puzzle_id = $1 ORDER BY time_seconds ASC LIMIT 10',
        [puzzle_id]
      );
      return res.status(200).json({ rows: result.rows || [] });

    } else if (req.method === 'POST') {
      const { player_name, puzzle_id, puzzle_name, time_seconds } = req.body;
      if (!player_name || !puzzle_id || !puzzle_name || time_seconds == null) {
        return res.status(400).json({ error: 'Missing fields' });
      }

      await neonQuery(
        'INSERT INTO leaderboard (player_name, puzzle_id, puzzle_name, time_seconds) VALUES ($1, $2, $3, $4)',
        [player_name, puzzle_id, puzzle_name, time_seconds]
      );
      return res.status(200).json({ ok: true });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};
