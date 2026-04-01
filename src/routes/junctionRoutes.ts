import { Router } from 'express';
import {
  linkAsset,       unlinkAsset,       getIncidentAssets,
  linkIOC,         unlinkIOC,         getIncidentIOCs,
  assignAnalyst,   unassignAnalyst,   getIncidentAnalysts,
} from '../controllers/junctionController';

// mergeParams lets us read :id from the parent /api/incidents/:id route
const router = Router({ mergeParams: true });

// Incident ↔ Asset
router.get('/assets',                  getIncidentAssets);
router.post('/assets/:assetId',        linkAsset);
router.delete('/assets/:assetId',      unlinkAsset);

// Incident ↔ IoC
router.get('/iocs',                    getIncidentIOCs);
router.post('/iocs/:iocId',            linkIOC);
router.delete('/iocs/:iocId',          unlinkIOC);

// Incident ↔ Analyst
router.get('/analysts',                getIncidentAnalysts);
router.post('/analysts/:analystId',    assignAnalyst);
router.delete('/analysts/:analystId',  unassignAnalyst);

export default router;
