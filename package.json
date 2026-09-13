// Goals FC Trial Portal — backend
// Express server that serves the static site (public/index.html,
// public/admin.html) and a Postgres-backed API for registrations and
// the admin dashboard. Data now survives restarts/redeploys, unlike the
// old local-JSON-file approach (Render's free/standard filesystem is
// ephemeral and wipes local files on every restart).

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'goalsfc2026'; // change this via an environment variable in production!

if (!process.env.DATABASE_URL) {
  console.error(
    'FATAL: DATABASE_URL is not set. Add a Postgres database in Render ' +
    'and set DATABASE_URL in this service\'s Environment settings.'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render's managed Postgres requires SSL; this works for both Render
  // Postgres and most other hosted providers.
  ssl: process.env.DATABASE_URL && !/localhost/.test(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false,
});

// ---- schema setup (runs once at boot; safe to run every deploy) ----
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      reference       TEXT PRIMARY KEY,
      full_name       TEXT,
      dob             TEXT,
      age             TEXT,
      phone           TEXT,
      email           TEXT,
      area            TEXT,
      position        TEXT,
      secondary       TEXT,
      foot            TEXT,
      height          TEXT,
      weight          TEXT,
      previous_club   TEXT,
      competition     TEXT,
      experience      TEXT,
      emergency_name  TEXT,
      emergency_phone TEXT,
      status          TEXT DEFAULT 'Pending',
      scores          JSONB DEFAULT '{}'::jsonb,
      notes           TEXT DEFAULT '',
      submitted_at    TIMESTAMPTZ DEFAULT now()
    );
  `);
}

// ---- row <-> API shape mapping (keeps the existing frontend contract) ----
function rowToPlayer(r) {
  return {
    reference: r.reference,
    fullName: r.full_name,
    dob: r.dob,
    age: r.age,
    phone: r.phone,
    email: r.email,
    area: r.area,
    position: r.position,
    secondary: r.secondary,
    foot: r.foot,
    height: r.height,
    weight: r.weight,
    previousClub: r.previous_club,
    competition: r.competition,
    experience: r.experience,
    emergencyName: r.emergency_name,
    emergencyPhone: r.emergency_phone,
    status: r.status,
    scores: r.scores || {},
    notes: r.notes || '',
    submittedAt: r.submitted_at instanceof Date ? r.submitted_at.toISOString() : r.submitted_at,
  };
}

async function loadPlayers() {
  const { rows } = await pool.query('SELECT * FROM players ORDER BY submitted_at ASC');
  return rows.map(rowToPlayer);
}

// ---- admin session tokens (kept in memory; reset on server restart) ----
const validTokens = new Set();
function requireAdmin(req, res, next) {
  const token = req.query.token || (req.body && req.body.token);
  if (!token || !validTokens.has(token)) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  next();
}

// ---- helpers ----
function makeReference() {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `GFC-${year}-${rand}`;
}
function toCSV(players) {
  const cols = [
    'reference', 'fullName', 'dob', 'age', 'phone', 'email', 'area',
    'position', 'secondary', 'foot', 'height', 'weight', 'previousClub',
    'competition', 'experience', 'emergencyName', 'emergencyPhone',
    'status', 'notes', 'submittedAt',
  ];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.join(',')];
  players.forEach((p) => lines.push(cols.map((c) => esc(p[c])).join(',')));
  return lines.join('\n');
}

// ---- public: registration ----
app.post('/api/register', async (req, res) => {
  const d = req.body || {};
  if (!d.fullName || !d.phone || !d.position) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  const reference = makeReference();
  try {
    await pool.query(
      `INSERT INTO players (
         reference, full_name, dob, age, phone, email, area, position,
         secondary, foot, height, weight, previous_club, competition,
         experience, emergency_name, emergency_phone, status, scores, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'Pending','{}','')`,
      [
        reference, d.fullName, d.dob, d.age, d.phone, d.email, d.area,
        d.position, d.secondary, d.foot, d.height, d.weight,
        d.previousClub, d.competition, d.experience, d.emergencyName,
        d.emergencyPhone,
      ]
    );
    res.json({ reference });
  } catch (err) {
    console.error('Registration failed:', err);
    res.status(500).json({ error: 'Could not save registration. Please try again.' });
  }
});

// ---- admin: login ----
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  validTokens.add(token);
  res.json({ token });
});

// ---- admin: list players (with optional search) ----
app.get('/api/admin/players', requireAdmin, async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase().trim();
    const all = await loadPlayers();
    let players = all;
    if (q) {
      players = all.filter((p) =>
        [p.reference, p.fullName, p.position, p.phone]
          .some((v) => String(v || '').toLowerCase().includes(q))
      );
    }
    const stats = {
      total: all.length,
      pending: all.filter((p) => p.status === 'Pending').length,
      shortlisted: all.filter((p) => p.status === 'Shortlisted').length,
      selected: all.filter((p) => p.status === 'Selected').length,
    };
    res.json({ players: players.slice().reverse(), stats });
  } catch (err) {
    console.error('Failed to load players:', err);
    res.status(500).json({ error: 'Could not load players.' });
  }
});

// ---- admin: get one player ----
app.get('/api/admin/players/:ref', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM players WHERE reference = $1', [req.params.ref]);
    if (!rows.length) return res.status(404).json({ error: 'Player not found.' });
    res.json(rowToPlayer(rows[0]));
  } catch (err) {
    console.error('Failed to load player:', err);
    res.status(500).json({ error: 'Could not load player.' });
  }
});

// ---- admin: update one player (status, scores, notes) ----
app.put('/api/admin/players/:ref', requireAdmin, async (req, res) => {
  try {
    const { status, scores, notes } = req.body || {};
    const { rows } = await pool.query(
      `UPDATE players SET
         status = COALESCE($2, status),
         scores = COALESCE($3, scores),
         notes  = COALESCE($4, notes)
       WHERE reference = $1
       RETURNING reference`,
      [req.params.ref, status ?? null, scores ? JSON.stringify(scores) : null, notes ?? null]
    );
    if (!rows.length) return res.status(404).json({ error: 'Player not found.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to update player:', err);
    res.status(500).json({ error: 'Could not update player.' });
  }
});

// ---- admin: export CSV ----
app.get('/api/admin/export', requireAdmin, async (req, res) => {
  try {
    const players = await loadPlayers();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(toCSV(players));
  } catch (err) {
    console.error('Failed to export CSV:', err);
    res.status(500).json({ error: 'Could not export players.' });
  }
});

const PORT = process.env.PORT || 3000;
ensureSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`Goals FC server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to set up database schema:', err);
    process.exit(1);
  });
