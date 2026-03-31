import { Router } from 'express';
import {
  createIncident,
  getAllIncidents,
  getIncidentById,
  updateIncidentStatus,
} from '../controllers/incidentController';

const router = Router();

router.post('/',     createIncident);
router.get('/',      getAllIncidents);
router.get('/:id',   getIncidentById);
router.put('/:id',   updateIncidentStatus);

export default router;
