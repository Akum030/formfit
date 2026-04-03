/**
 * Diet Plan Routes — AI-generated Indian diet recommendations.
 *
 * Endpoints:
 *   POST /api/diet/generate      — Generate a new diet plan using Gemini
 *   GET  /api/diet/plans/:userId  — Get user's diet plans
 *   GET  /api/diet/active/:userId — Get active diet plan
 *   DELETE /api/diet/plans/:id    — Delete a diet plan
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../models/index';
import { generateDietPlan } from '../services/dietPlanner';

export const dietRouter = Router();

// ── POST /api/diet/generate — Generate AI diet plan ─────────────────
dietRouter.post('/diet/generate', async (req: Request, res: Response) => {
  try {
    const { userId, goal, weightKg, heightCm, age, gender, activityLevel, dietaryPreferences, allergies } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const validGoals = ['muscle_gain', 'fat_loss', 'maintenance', 'general_health'];
    const selectedGoal = validGoals.includes(goal) ? goal : 'general_health';

    // Fetch recent food logs to personalize plan
    const recentLogs = await prisma.foodLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 10,
      select: { description: true, calories: true, protein: true, carbs: true, fat: true, mealType: true },
    });

    // Fetch recent workout sessions for activity context
    const recentSessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: { exerciseId: true, totalReps: true, avgFormScore: true },
    });

    const plan = await generateDietPlan({
      goal: selectedGoal,
      weightKg,
      heightCm,
      age,
      gender,
      activityLevel,
      dietaryPreferences,
      allergies,
      recentFoodLogs: recentLogs,
      recentWorkouts: recentSessions,
    });

    // Deactivate previous plans for this user
    await prisma.dietPlan.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    // Save the new plan
    const savedPlan = await prisma.dietPlan.create({
      data: {
        userId,
        goal: selectedGoal,
        targetCalories: plan.targetCalories,
        targetProtein: plan.targetProtein,
        targetCarbs: plan.targetCarbs,
        targetFat: plan.targetFat,
        planJson: JSON.stringify(plan.meals),
        aiRationale: plan.rationale,
        isActive: true,
      },
    });

    res.status(201).json({
      plan: {
        ...savedPlan,
        meals: plan.meals,
      },
    });
  } catch (err) {
    console.error('[Diet] generate error:', err);
    res.status(500).json({ error: 'Failed to generate diet plan' });
  }
});

// ── GET /api/diet/plans/:userId — Get all diet plans ────────────────
dietRouter.get('/diet/plans/:userId', async (req: Request<{ userId: string }>, res: Response) => {
  try {
    const plans = await prisma.dietPlan.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Parse planJson for each plan
    const parsed = plans.map((p) => ({
      ...p,
      meals: JSON.parse(p.planJson),
    }));

    res.json(parsed);
  } catch (err) {
    console.error('[Diet] list error:', err);
    res.status(500).json({ error: 'Failed to list diet plans' });
  }
});

// ── GET /api/diet/active/:userId — Get active diet plan ─────────────
dietRouter.get('/diet/active/:userId', async (req: Request<{ userId: string }>, res: Response) => {
  try {
    const plan = await prisma.dietPlan.findFirst({
      where: { userId: req.params.userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan) {
      res.json({ plan: null });
      return;
    }

    res.json({
      plan: {
        ...plan,
        meals: JSON.parse(plan.planJson),
      },
    });
  } catch (err) {
    console.error('[Diet] active error:', err);
    res.status(500).json({ error: 'Failed to get active diet plan' });
  }
});

// ── DELETE /api/diet/plans/:id — Delete a diet plan ─────────────────
dietRouter.delete('/diet/plans/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    await prisma.dietPlan.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[Diet] delete error:', err);
    res.status(500).json({ error: 'Failed to delete diet plan' });
  }
});
