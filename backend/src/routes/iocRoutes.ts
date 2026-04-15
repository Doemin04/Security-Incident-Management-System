import { Router } from 'express';
import {
  createIOC,
  getAllIOCs,
  getIOCById,
  updateIOC,
  deleteIOC,
} from '../controllers/iocController';

const router = Router();

router.post('/',    createIOC);
router.get('/',     getAllIOCs);
router.get('/:id',  getIOCById);
router.put('/:id',  updateIOC);
router.delete('/:id', deleteIOC);

export default router;
