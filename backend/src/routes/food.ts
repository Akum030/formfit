/**
 * Food Journal Routes — Photo-based Indian diet tracking with Gemini Vision.
 *
 * Endpoints:
 *   POST /api/food/analyze   — Upload food photo for AI nutritional analysis
 *   POST /api/food/log       — Save a food log entry (with or without photo)
 *   GET  /api/food/logs/:userId — Get food logs for a user (with date filters)
 *   GET  /api/food/daily/:userId — Get daily macro summary
 *   DELETE /api/food/logs/:id — Delete a food log entry
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../models/index';
import { analyzeFoodPhoto, estimateNutrition } from '../services/foodAnalyzer';

export const foodRouter = Router();

// ── POST /api/food/analyze — Analyze food photo with Gemini Vision ──
foodRouter.post('/food/analyze', async (req: Request, res: Response) => {
  try {
    const { photoBase64, description } = req.body;

    if (!photoBase64 && !description) {
      res.status(400).json({ error: 'Provide photoBase64 (image) or description (text) of the food' });
      return;
    }

    let analysis;
    if (photoBase64) {
      // Use Gemini Vision to analyze the food photo
      analysis = await analyzeFoodPhoto(photoBase64, description);
    } else {
      // Text-only estimation for manual entry
      analysis = await estimateNutrition(description!);
    }

    res.json(analysis);
  } catch (err) {
    console.error('[Food] analyze error:', err);
    res.status(500).json({ error: 'Failed to analyze food' });
  }
});

// ── POST /api/food/log — Save a food log entry ─────────────────────
foodRouter.post('/food/log', async (req: Request, res: Response) => {
  try {
    const { userId, mealType, description, photoBase64, calories, protein, carbs, fat, fiber, items, aiAnalysis } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    // Validate meal type
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    const meal = validMealTypes.includes(mealType) ? mealType : 'snack';

    const foodLog = await prisma.foodLog.create({
      data: {
        userId,
        mealType: meal,
        description: description || null,
        // Store a compressed version — strip data URI prefix if present
        photoBase64: photoBase64 ? photoBase64.substring(0, 500000) : null,
        calories: calories ?? null,
        protein: protein ?? null,
        carbs: carbs ?? null,
        fat: fat ?? null,
        fiber: fiber ?? null,
        items: items ? JSON.stringify(items) : null,
        aiAnalysis: aiAnalysis || null,
      },
    });

    res.status(201).json(foodLog);
  } catch (err) {
    console.error('[Food] log error:', err);
    res.status(500).json({ error: 'Failed to log food' });
  }
});

// ── GET /api/food/logs/:userId — Get food logs with date filters ────
foodRouter.get('/food/logs/:userId', async (req: Request<{ userId: string }>, res: Response) => {
  try {
    const { userId } = req.params;
    const dateStr = req.query.date as string | undefined;
    const limit = Math.min(parseInt(String(req.query.limit)) || 50, 200);

    const where: Record<string, unknown> = { userId };

    if (dateStr) {
      // Filter to a specific day
      const date = new Date(dateStr);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      where.loggedAt = { gte: startOfDay, lt: endOfDay };
    }

    const logs = await prisma.foodLog.findMany({
      where,
      orderBy: { loggedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        mealType: true,
        description: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        fiber: true,
        items: true,
        loggedAt: true,
        // Exclude photoBase64 from list queries (too large)
      },
    });

    res.json(logs);
  } catch (err) {
    console.error('[Food] list error:', err);
    res.status(500).json({ error: 'Failed to list food logs' });
  }
});

// ── GET /api/food/daily/:userId — Daily macro summary ───────────────
foodRouter.get('/food/daily/:userId', async (req: Request<{ userId: string }>, res: Response) => {
  try {
    const { userId } = req.params;
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const date = new Date(dateStr);
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const logs = await prisma.foodLog.findMany({
      where: {
        userId,
        loggedAt: { gte: startOfDay, lt: endOfDay },
      },
    });

    const totals = {
      date: dateStr,
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFiber: 0,
      mealCount: logs.length,
      meals: {
        breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 },
        lunch: { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 },
        dinner: { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 },
        snack: { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 },
      } as Record<string, { calories: number; protein: number; carbs: number; fat: number; count: number }>,
    };

    for (const log of logs) {
      totals.totalCalories += log.calories || 0;
      totals.totalProtein += log.protein || 0;
      totals.totalCarbs += log.carbs || 0;
      totals.totalFat += log.fat || 0;
      totals.totalFiber += log.fiber || 0;

      const meal = totals.meals[log.mealType];
      if (meal) {
        meal.calories += log.calories || 0;
        meal.protein += log.protein || 0;
        meal.carbs += log.carbs || 0;
        meal.fat += log.fat || 0;
        meal.count++;
      }
    }

    res.json(totals);
  } catch (err) {
    console.error('[Food] daily error:', err);
    res.status(500).json({ error: 'Failed to get daily summary' });
  }
});

// ── DELETE /api/food/logs/:id — Delete a food log entry ─────────────
foodRouter.delete('/food/logs/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    await prisma.foodLog.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[Food] delete error:', err);
    res.status(500).json({ error: 'Failed to delete food log' });
  }
});
