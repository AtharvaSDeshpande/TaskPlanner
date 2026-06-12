import { Router } from 'express';
import { ingestLogs } from '../controllers/logController.js';

const router = Router();

// Unauthenticated by design — the browser ships logs here, even pre-login.
router.post('/', ingestLogs);

export default router;
