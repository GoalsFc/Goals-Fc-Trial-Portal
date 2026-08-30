// Goals FC Trial Portal — backend
// Simple Express server that serves the static site (public/index.html,
// public/admin.html) and a small JSON-file-backed API for registrations
// and the admin dashboard. No database required — good fit for free
// hosts like Render's free web service tier.

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'players.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'goalsfc2026'; // change this via an environment variable in production!

// ---- tiny JSON "database" ----
function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}
function loadPlayers() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}
function savePlayers(players) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(players, null, 2), 'utf8');
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
app.post('/api/register', (req, res) => {
  const d = req.body || {};
  if (!d.fullName || !d.phone || !d.position) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  const players = loadPlayers();
  const reference = makeReference();
  players.push({
    reference,
    fullName: d.fullName,
    dob: d.dob,
    age: d.age,
    phone: d.phone,
    email: d.email,
    area: d.area,
    position: d.position,
    secondary: d.secondary,
    foot: d.foot,
    height: d.height,
    weight: d.weight,
    previousClub: d.previousClub,
    competition: d.competition,
    experience: d.experience,
    emergencyName: d.emergencyName,
    emergencyPhone: d.emergencyPhone,
    status: 'Pending',
    scores: {},
    notes: '',
    submittedAt: new Date().toISOString(),
  });
  savePlayers(players);
  res.json({ reference });
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
app.get('/api/admin/players', requireAdmin, (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  let players = loadPlayers();
  if (q) {
    players = players.filter((p) =>
      [p.reference, p.fullName, p.position, p.phone]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }
  const all = loadPlayers();
  const stats = {
    total: all.length,
    pending: all.filter((p) => p.status === 'Pending').length,
    shortlisted: all.filter((p) => p.status === 'Shortlisted').length,
    selected: all.filter((p) => p.status === 'Selected').length,
  };
  res.json({ players: players.slice().reverse(), stats });
});

// ---- admin: get one player ----
app.get('/api/admin/players/:ref', requireAdmin, (req, res) => {
  const players = loadPlayers();
  const player = players.find((p) => p.reference === req.params.ref);
  if (!player) return res.status(404).json({ error: 'Player not found.' });
  res.json(player);
});

// ---- admin: update one player (status, scores, notes) ----
app.put('/api/admin/players/:ref', requireAdmin, (req, res) => {
  const players = loadPlayers();
  const idx = players.findIndex((p) => p.reference === req.params.ref);
  if (idx === -1) return res.status(404).json({ error: 'Player not found.' });
  const { status, scores, notes } = req.body || {};
  if (status !== undefined) players[idx].status = status;
  if (scores !== undefined) players[idx].scores = scores;
  if (notes !== undefined) players[idx].notes = notes;
  savePlayers(players);
  res.json({ ok: true });
});

// ---- admin: export CSV ----
app.get('/api/admin/export', requireAdmin, (req, res) => {
  const players = loadPlayers();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(toCSV(players));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Goals FC server running on port ${PORT}`));
