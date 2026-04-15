import { Router } from 'express';
import {
  createIncident,
  deleteIncident,
  getAllIncidents,
  getIncidentById,
  updateIncidentStatus,
} from '../controllers/incidentController';

const router = Router();

router.post('/',     createIncident);
router.get('/',      getAllIncidents);
router.get('/:id',   getIncidentById);
router.put('/:id',   updateIncidentStatus);
router.delete('/:id', deleteIncident);

export default router;
