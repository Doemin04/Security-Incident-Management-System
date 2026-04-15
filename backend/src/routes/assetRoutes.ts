import { Router } from 'express';
import {
  createAsset,
  getAllAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
} from '../controllers/assetController';

const router = Router();

router.post('/',    createAsset);
router.get('/',     getAllAssets);
router.get('/:id',  getAssetById);
router.put('/:id',  updateAsset);
router.delete('/:id', deleteAsset);

export default router;
