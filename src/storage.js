const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TICKETS_FILE)) fs.writeFileSync(TICKETS_FILE, '{}');
}

function loadTickets() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
}

function saveTickets(tickets) {
  ensureStorage();
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
}

function loadConfig() {
  const configPath = path.join(__dirname, '..', 'config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

module.exports = { loadTickets, saveTickets, loadConfig };
