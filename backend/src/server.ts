import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { config } from './config';
import { lockRouter } from './routes/lockRoutes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', lockRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    ok: false,
    error: 'Rota não encontrada.',
  });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Erro interno inesperado.';
  console.error('[API Error]', err);
  res.status(500).json({
    ok: false,
    error: message,
    mode: config.useMock ? 'mock' : 'tuya',
  });
});

app.listen(config.port, () => {
  console.log(
    `[tuya-lock-dashboard] Backend rodando em http://localhost:${config.port} | Modo: ${
      config.useMock ? 'MOCK (USE_MOCK=true)' : 'TUYA CLOUD (USE_MOCK=false)'
    } | Timezone: ${config.timezone}`
  );
});
