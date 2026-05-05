import { env } from './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { recoverPendingEmails } from './services/queueService.js';

// Route imports
import healthRouter from './routes/health.js';
import ticketRouter from './routes/ticket.js';
import uploadRouter from './routes/upload.js';
import verifyRouter from './routes/verify.js';
import adminRouter from './routes/admin.js';
import profileRouter from './routes/profile.js';

const app = express();

// --- Global Middleware ---
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: [env.frontendUrl, 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
app.use(express.json({ limit: '1mb' }));

// --- Routes ---
app.use('/', healthRouter);
app.use('/api', ticketRouter);
app.use('/api', uploadRouter);
app.use('/api', verifyRouter);
app.use('/api', adminRouter);
app.use('/api', profileRouter);

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// --- Global Error Handler ---
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Start Server ---
app.listen(env.port, () => {
  console.log(`\x1b[36m[QR PRO Server]\x1b[0m Running on port ${env.port}`);
  console.log(`\x1b[36m[QR PRO Server]\x1b[0m Frontend: ${env.frontendUrl}`);

  // Recover any pending emails from before a restart
  recoverPendingEmails().catch((err) => {
    console.error('[Queue] Recovery failed:', err.message);
  });
});
