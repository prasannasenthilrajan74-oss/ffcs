import { Router, Request, Response } from 'express';
import { Department } from '../models/Department';

const router = Router();

// GET /api/departments — public list with remaining counts
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const departments = await Department.find({ active: true })
      .select('name capacity allocatedCount')
      .lean({ virtuals: true })
      .sort({ name: 1 });

    res.json(
      departments.map((d) => ({
        name: d.name,
        capacity: d.capacity,
        allocatedCount: d.allocatedCount,
        remaining: Math.max(0, d.capacity - d.allocatedCount),
        isFull: d.allocatedCount >= d.capacity,
      }))
    );
  } catch (err) {
    console.error('[GET /api/departments]', err);
    res.status(500).json({ error: 'Failed to load departments' });
  }
});

export default router;
