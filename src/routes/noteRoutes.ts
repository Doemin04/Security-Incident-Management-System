import { Router } from 'express';
import {
  createNote,
  getNotesByIncident,
  deleteNote,
} from '../controllers/noteController';

// Mounted at /api/incidents — uses mergeParams to access :id from the parent router
const router = Router({ mergeParams: true });

router.post('/',           createNote);
router.get('/',            getNotesByIncident);
router.delete('/:noteId',  deleteNote);

export default router;
