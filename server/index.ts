import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';

import uploadsRouter from './routes.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.set('trust proxy', 1);
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
app.use('/api', uploadsRouter);

app.listen(port, () =>
  console.log(`Upload API listening on http://localhost:${port}`),
);
