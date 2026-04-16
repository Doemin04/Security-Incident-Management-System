import { Router } from 'express';
import { importLogs } from '../controllers/logImportController';

const router = Router();

router.post('/', importLogs);

export default router;
