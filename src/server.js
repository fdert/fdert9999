// في ملف src/server.js على GitHub
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

let qrCodes = {};

app.get('/qr/:sessionId', (req, res) => {
  const qr = qrCodes[req.params.sessionId];
  res.json({ qr: qr || null, message: qr ? 'QR ready' : 'QR generation pending' });
});

// عند إنشاء جلسة جديدة
async function startSession(sessionId) {
  const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionId}`);
  const sock = makeWASocket({ auth: state });
  
  sock.ev.on('connection.update', ({ qr }) => {
    if (qr) {
      qrCodes[sessionId] = qr; // حفظ رمز QR
    }
  });
}
