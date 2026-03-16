import { test, expect } from '@playwright/test';

test.describe('AI Gym Trainer — E2E', () => {

  test('homepage loads with exercise selection', async ({ page }) => {
    await page.goto('/');
    // Dismiss onboarding modal if present
    const modal = page.locator('.fixed.inset-0');
    if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      const nameInput = page.locator('input[placeholder]');
      if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nameInput.fill('TestUser');
        await page.locator('button', { hasText: /start|begin|go|let/i }).click();
      }
    }
    // Title visible
    await expect(page.getByRole('heading', { name: /FitSenseAI/i })).toBeVisible();
    // Exercise cards visible
    await expect(page.locator('text=Squat')).toBeVisible();
    await expect(page.locator('text=Push-up')).toBeVisible();
    await expect(page.locator('text=Curl')).toBeVisible();
    await expect(page.locator('text=Lunge')).toBeVisible();
    await expect(page.getByText('Press', { exact: true })).toBeVisible();
  });

  test('MoveNet model status indicator is visible', async ({ page }) => {
    await page.goto('/');
    // Should show either loading or ready status
    const status = page.locator('text=/MoveNet|Loading/').first();
    await expect(status).toBeVisible({ timeout: 10_000 });
  });

  test('exercise selection highlights card', async ({ page }) => {
    await page.goto('/');
    // Dismiss onboarding modal if present
    const modal = page.locator('.fixed.inset-0');
    if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      const nameInput = page.locator('input[placeholder]');
      if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nameInput.fill('TestUser');
        await page.locator('button', { hasText: /start|begin|go|let/i }).click();
      }
    }
    // Click on Squat
    await page.locator('text=Squat').click();
    // Start button should not say "Select an exercise" — may show "Loading AI model..." or "Start AI Coaching"
    const startBtn = page.locator('button', { hasText: /Start AI Coaching|Loading AI model/ });
    await expect(startBtn).toBeVisible();
  });

  test('backend health endpoint responds', async ({ request }) => {
    const res = await request.get('http://localhost:4000/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('ai-gym-trainer');
  });

  test('backend exercises endpoint returns exercise list', async ({ request }) => {
    const res = await request.get('http://localhost:4000/api/exercises');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // API returns an array of exercises directly
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.length).toBeGreaterThanOrEqual(5);
  });

  test('can create a session via API', async ({ request }) => {
    const res = await request.post('http://localhost:4000/api/sessions', {
      data: { exerciseId: 'squat' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.sessionId).toBeDefined();
    expect(typeof body.sessionId).toBe('string');
  });

  test('can start coaching via API', async ({ request }) => {
    // Create session first
    const sessionRes = await request.post('http://localhost:4000/api/sessions', {
      data: { exerciseId: 'bicep_curl' },
    });
    const { sessionId } = await sessionRes.json();

    // Start coaching
    const coachRes = await request.post('http://localhost:4000/api/coaching/start', {
      data: { sessionId, exerciseId: 'bicep_curl' },
    });
    expect(coachRes.ok()).toBeTruthy();
    const body = await coachRes.json();
    expect(body.started).toBe(true);
    expect(body.coaching).toBeDefined();
    expect(body.coaching.text).toBeTruthy();
    expect(body.coaching.trigger).toBe('session_start');
  });

  test('pose event updates coaching engine', async ({ request }) => {
    // Create session + start coaching
    const sessionRes = await request.post('http://localhost:4000/api/sessions', {
      data: { exerciseId: 'squat' },
    });
    const { sessionId } = await sessionRes.json();

    await request.post('http://localhost:4000/api/coaching/start', {
      data: { sessionId, exerciseId: 'squat' },
    });

    // Send pose event with low score
    const poseRes = await request.post('http://localhost:4000/api/events/pose', {
      data: { sessionId, score: 30, issues: ['Knees caving in'] },
    });
    expect(poseRes.ok()).toBeTruthy();
    const body = await poseRes.json();
    // Should have coaching field (may or may not trigger due to rate limiting)
    expect(body).toHaveProperty('coaching');
  });

  test('rep event works correctly', async ({ request }) => {
    const sessionRes = await request.post('http://localhost:4000/api/sessions', {
      data: { exerciseId: 'pushup' },
    });
    const { sessionId } = await sessionRes.json();

    await request.post('http://localhost:4000/api/coaching/start', {
      data: { sessionId, exerciseId: 'pushup' },
    });

    const repRes = await request.post('http://localhost:4000/api/events/rep', {
      data: { sessionId, repCount: 1, repScore: 85 },
    });
    expect(repRes.ok()).toBeTruthy();
    const body = await repRes.json();
    expect(body).toHaveProperty('coaching');
  });

  test('Gemini analyze endpoint responds', async ({ request }) => {
    const sessionRes = await request.post('http://localhost:4000/api/sessions', {
      data: { exerciseId: 'squat' },
    });
    const { sessionId } = await sessionRes.json();

    await request.post('http://localhost:4000/api/coaching/start', {
      data: { sessionId, exerciseId: 'squat' },
    });

    const analyzeRes = await request.post('http://localhost:4000/api/events/analyze', {
      data: {
        sessionId,
        exerciseName: 'Squat',
        exerciseId: 'squat',
        angles: { left_knee: 95.2, left_hip: 88.1, right_knee: 97.5 },
        keypointPositions: {},
        currentPhase: 'bottom',
        repCount: 3,
      },
    });
    expect(analyzeRes.ok()).toBeTruthy();
    const body = await analyzeRes.json();
    // Should have analysis result (either from Gemini or null)
    expect(body).toHaveProperty('analysis');
  });

  test('history page loads', async ({ page }) => {
    await page.goto('/history');
    await expect(page.locator('text=/Workout History|No sessions/i')).toBeVisible({ timeout: 5_000 });
  });

  test('session can be ended', async ({ request }) => {
    const sessionRes = await request.post('http://localhost:4000/api/sessions', {
      data: { exerciseId: 'lunge' },
    });
    const { sessionId } = await sessionRes.json();

    await request.post('http://localhost:4000/api/coaching/start', {
      data: { sessionId, exerciseId: 'lunge' },
    });

    const endRes = await request.patch(`http://localhost:4000/api/sessions/${sessionId}/end`, {
      data: { avgFormScore: 78, totalReps: 10 },
    });
    expect(endRes.ok()).toBeTruthy();

    const stopRes = await request.post('http://localhost:4000/api/coaching/stop', {
      data: { sessionId },
    });
    expect(stopRes.ok()).toBeTruthy();
    const body = await stopRes.json();
    expect(body.stopped).toBe(true);
  });
});
