import { Router } from 'express';
import { getThreatCampaigns } from '../controllers/correlationController';

const router = Router();

router.get('/threats', getThreatCampaigns);

export default router;
