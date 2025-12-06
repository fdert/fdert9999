const express = require('express');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');
const cors = require('cors');
const qrcode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

const sessions = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all sessions
app.get('/sessions', (req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
    id,
    status: session.status,
    createdAt: session.createdAt
  }));
  res.json(sessionList);
});

// Create session
app.post('/sessions/:id', async (req, res) => {
  const { id } = req.params;
  if (sessions.has(id)) {
    return res.status(400).json({ error: 'Session already exists' });
  }
  
  sessions.set(id, { status: 'connecting', createdAt: new Date().toISOString(), qr: null, socket: null });
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState(`./auth/${id}`);
    const socket = makeWASocket({ auth: state, printQRInTerminal: false });
    
    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('connection.update', ({ qr, connection, lastDisconnect }) => {
      const session = sessions.get(id);
      if (qr) {
        qrcode.toDataURL(qr, (err, url) => {
          if (!err) session.qr = url;
        });
      }
      if (connection === 'open') session.status = 'connected';
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        session.status = shouldReconnect ? 'reconnecting' : 'disconnected';
      }
    });
    
    sessions.get(id).socket = socket;
    res.json({ id, status: 'connecting' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get QR code
app.get('/sessions/:id/qr', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ qr: session.qr });
});

// Send message
app.post('/sessions/:id/send', async (req, res) => {
  const { to, message } = req.body;
  const session = sessions.get(req.params.id);
  if (!session?.socket) return res.status(404).json({ error: 'Session not found' });
  
  try {
    await session.socket.sendMessage(`${to}@s.whatsapp.net`, { text: message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete session
app.delete('/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (session?.socket) session.socket.logout();
  sessions.delete(req.params.id);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
