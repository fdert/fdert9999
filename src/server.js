const express = require('express');
const cors = require('cors');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

const sessions = {};
const qrCodes = {};

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/sessions', (req, res) => {
  const sessionList = Object.keys(sessions).map(id => ({
    id,
    status: sessions[id]?.status || 'pending',
    createdAt: sessions[id]?.createdAt
  }));
  res.json(sessionList);
});

app.post('/sessions', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Session ID required' });
  if (sessions[id]) return res.json({ id, status: sessions[id].status });
  sessions[id] = { status: 'pending', createdAt: new Date().toISOString() };
  startSession(id);
  res.json({ id, status: 'pending' });
});

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

app.delete('/sessions/:id', (req, res) => {
  const { id } = req.params;
  delete sessions[id];
  delete qrCodes[id];
  res.json({ success: true });
});

app.post('/send/text', async (req, res) => {
  const { sessionId, to, message } = req.body;
  const session = sessions[sessionId];
  if (!session?.socket) return res.status(400).json({ error: 'Session not connected' });
  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    await session.socket.sendMessage(jid, { text: message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function startSession(sessionId) {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionId}`);
    const socket = makeWASocket({ auth: state, printQRInTerminal: true });
    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('connection.update', ({ qr, connection }) => {
      if (qr) {
        qrCodes[sessionId] = qr;
        console.log(`QR generated for: ${sessionId}`);
      }
      if (connection === 'open') {
        sessions[sessionId].status = 'connected';
        sessions[sessionId].socket = socket;
        delete qrCodes[sessionId];
      }
      if (connection === 'close') {
        sessions[sessionId].status = 'disconnected';
      }
    });
  } catch (error) {
    console.error(`Error starting session ${sessionId}:`, error);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
