import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import serverless from 'serverless-http';

import uploadsRouter from '../../server/routes.js';

const app = express();

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
app.use('/api', uploadsRouter);

export const handler = serverless(app);
