const express = require('express');
const cors = require('cors');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

const sessions = {};
const qrCodes = {};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all sessions
app.get('/sessions', (req, res) => {
  const sessionList = Object.keys(sessions).map(id => ({
    id,
    status: sessions[id]?.status || 'pending',
    createdAt: sessions[id]?.createdAt
  }));
  res.json(sessionList);
});

// Create session
app.post('/sessions', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Session ID required' });
  
  if (sessions[id]) {
    return res.json({ id, status: sessions[id].status });
  }

  sessions[id] = { status: 'pending', createdAt: new Date().toISOString() };
  startSession(id);
  res.json({ id, status: 'pending' });
});

// Get QR code
app.get('/qr/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const qr = qrCodes[sessionId];
  
  if (qr) {
    const qrImage = await QRCode.toDataURL(qr);
    res.json({ qr: qrImage });
  } else {
    res.json({ qr: null, message: 'QR generation pending' });
  }
});

// Delete session
app.delete('/sessions/:id', (req, res) => {
  const { id } = req.params;
  delete sessions[id
