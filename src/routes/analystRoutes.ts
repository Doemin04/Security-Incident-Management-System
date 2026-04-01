import { Router } from 'express';
import {
  createAnalyst,
  getAllAnalysts,
  getAnalystById,
  updateAnalyst,
  deleteAnalyst,
} from '../controllers/analystController';

const router = Router();

router.post('/',      createAnalyst);
router.get('/',       getAllAnalysts);
router.get('/:id',    getAnalystById);
router.put('/:id',    updateAnalyst);
router.delete('/:id', deleteAnalyst);

export default router;
