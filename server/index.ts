import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import uploadsRouter from './routes.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '20kb' }));
app.use(
  '/api/uploads',
  rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
);
app.use(
  '/api/uploads/session',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    // Guests often share one venue WiFi IP, so this must stay generous enough
    // that a handful of mistyped passcodes doesn't lock out everyone on it.
    limit: 40,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Only failed attempts (wrong/missing passcode, bad request, etc.) count,
    // so this only throttles brute-forcing and doesn't limit real uploads.
    skipSuccessfulRequests: true,
  }),
);
app.use('/api', uploadsRouter);

app.listen(port, () =>
  console.log(`Upload API listening on http://localhost:${port}`),
);
