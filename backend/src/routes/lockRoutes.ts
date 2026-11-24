import { Router, Request, Response, NextFunction } from 'express';
import { config, formatTimezoneDate } from '../config';
import { MockLockService } from '../services/mockLockService';
import { TuyaLockService } from '../services/tuyaLockService';
import { ILockService } from '../types/lock';

const lockService: ILockService = config.useMock
  ? new MockLockService()
  : new TuyaLockService();

export const lockRouter = Router();

lockRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'tuya-lock-dashboard-backend',
    mode: lockService.mode,
    useMock: config.useMock,
    timezone: config.timezone,
    localTime: formatTimezoneDate(new Date()),
    tuya: {
      projectName: config.tuya.projectName,
      projectCode: config.tuya.projectCode,
      endpoint: config.tuya.endpoint,
      deviceId: config.tuya.deviceId,
      deviceMac: config.tuya.deviceMac,
      credentialsConfigured: Boolean(config.tuya.accessId && config.tuya.accessSecret),
    },
  });
});

lockRouter.get('/lock/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await lockService.getStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

lockRouter.get('/lock/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limitParam = req.query.limit ? Number(req.query.limit) : 20;
    const limit = Number.isFinite(limitParam) ? limitParam : 20;
    const logs = await lockService.getLogs(limit);
    res.json({
      mode: lockService.mode,
      timezone: config.timezone,
      count: logs.length,
      logs,
    });
  } catch (error) {
    next(error);
  }
});

lockRouter.post('/lock/unlock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor =
      typeof req.body?.actor === 'string' && req.body.actor.trim()
        ? req.body.actor.trim()
        : 'Operador Dashboard';
    const result = await lockService.unlock(actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

lockRouter.post('/lock/lock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor =
      typeof req.body?.actor === 'string' && req.body.actor.trim()
        ? req.body.actor.trim()
        : 'Operador Dashboard';
    const result = await lockService.lock(actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
