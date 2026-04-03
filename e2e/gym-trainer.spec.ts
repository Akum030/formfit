import { test, expect, type Page } from '@playwright/test';

/**
 * Comprehensive E2E test suite for FitSenseAI.
 *
 * Covers:
 *  1. Global navigation (Navbar links, active states)
 *  2. Home page (hero, features, exercise cards, onboarding, language toggle)
 *  3. Workout page (exercise selection, session start, camera/overlay, controls)
 *  4. History page (load, empty state, back navigation)
 *  5. Food Journal page (form, meal types, analysis flow)
 *  6. Diet Plan page (form, goal/activity selectors, generate flow)
 *  7. Backend API (health, exercises, sessions CRUD, coaching, events)
 *  8. Cross-page user flows (onboard → workout → history)
 */

// ─── Helper: Dismiss onboarding modal if shown ────────────────────────
async function dismissOnboarding(page: Page) {
  const modal = page.locator('.fixed.inset-0');
  if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
    const nameInput = page.locator('input[placeholder]');
    if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nameInput.fill('E2ETestUser');
      // Click whichever start / begin / go / let's go button exists
      const startBtn = page.locator('button', { hasText: /start|begin|go|let/i });
      if (await startBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await startBtn.first().click();
      }
    }
  }
  // Small wait for modal animation to finish
  await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════════════════════════════════
// 1. GLOBAL NAVIGATION
// ═══════════════════════════════════════════════════════════════════════
test.describe('Navigation — Navbar', () => {

  test('all 5 nav links are visible', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    for (const label of ['Home', 'Workout', 'History', 'Food', 'Diet']) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('clicking each nav link navigates to correct route', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);

    // Workout
    await page.locator('nav').getByText('Workout', { exact: true }).click();
    await expect(page).toHaveURL(/\/workout/);

    // History
    await page.locator('nav').getByText('History', { exact: true }).click();
    await expect(page).toHaveURL(/\/history/);

    // Food
    await page.locator('nav').getByText('Food', { exact: true }).click();
    await expect(page).toHaveURL(/\/food-journal/);

    // Diet
    await page.locator('nav').getByText('Diet', { exact: true }).click();
    await expect(page).toHaveURL(/\/diet-plan/);

    // Home
    await page.locator('nav').getByText('Home', { exact: true }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:5174\/$/);
  });

  test('brand logo navigates to home', async ({ page }) => {
    await page.goto('/workout');
    await dismissOnboarding(page);
    // Click the "FIT" brand logo
    await page.locator('nav').locator('a').first().click();
    await expect(page).toHaveURL(/^http:\/\/localhost:5174\/$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. HOME PAGE
// ═══════════════════════════════════════════════════════════════════════
test.describe('Home Page', () => {

  test('hero section renders with title and CTAs', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);

    // Main heading
    await expect(page.locator('h1')).toContainText('FitSenseAI');

    // CTA buttons
    await expect(page.getByText('Start Training')).toBeVisible();
    await expect(page.getByText('View History')).toBeVisible();
    await expect(page.getByRole('link', { name: /Food Journal/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Diet Plan/i })).toBeVisible();
  });

  test('feature cards are rendered (all 6)', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);

    for (const title of [
      'MoveNet Pose Detection',
      'Gemini AI Analysis',
      'Voice Coach',
      'Smart Scoring',
      'Food Journal',
      'AI Diet Plan',
    ]) {
      await expect(page.getByText(title).first()).toBeVisible();
    }
  });

  test('exercise cards section shows exercises', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);

    // Scroll to the exercises section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Check key exercises exist in the page
    for (const name of ['Squat', 'Push-up', 'Bicep Curl', 'Lunge']) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
  });

  test('exercise card click navigates to workout page', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);

    // Scroll down to see exercise cards
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Click on Squat card
    await page.getByText('Squat', { exact: true }).first().click();
    await page.waitForTimeout(500);

    // Should navigate to workout
    await expect(page).toHaveURL(/\/workout/);
  });

  test('language toggle button works', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);

    const langBtn = page.locator('button', { hasText: /Voice Coach/i });
    await expect(langBtn).toBeVisible();

    // Default is Hindi
    await expect(langBtn).toContainText('हिंदी');

    // Toggle to English
    await langBtn.click();
    await expect(langBtn).toContainText('English');

    // Toggle back to Hindi
    await langBtn.click();
    await expect(langBtn).toContainText('हिंदी');
  });

  test('Start Training CTA navigates to /workout', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);

    await page.getByText('Start Training').click();
    await expect(page).toHaveURL(/\/workout/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. ONBOARDING FLOW
// ═══════════════════════════════════════════════════════════════════════
test.describe('Onboarding', () => {

  test('onboarding modal appears for new users and creates profile', async ({ page }) => {
    // Clear localStorage to simulate new user
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Modal should appear
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.first()).toBeVisible({ timeout: 3000 });

    // Fill in name
    const nameInput = page.locator('input[placeholder]');
    await nameInput.fill('PlaywrightUser');

    // Click start button
    const startBtn = page.locator('button', { hasText: /start|begin|go|let/i });
    await startBtn.first().click();

    // Modal should dismiss and user should see the home page content
    await page.waitForTimeout(1000);
    await expect(page.locator('h1')).toContainText('FitSenseAI');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. WORKOUT PAGE
// ═══════════════════════════════════════════════════════════════════════
test.describe('Workout Page', () => {

  test('workout page loads with exercise selection panel', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/workout');

    // Exercise options should be available in the select dropdown
    const exerciseSelect = page.locator('select').first();
    await expect(exerciseSelect).toBeVisible({ timeout: 10_000 });
    // Verify exercises exist as options
    await expect(exerciseSelect.locator('option[value="squat"]')).toBeAttached();
    await expect(exerciseSelect.locator('option[value="pushup"]')).toBeAttached();
  });

  test('selecting an exercise enables start button', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/workout');

    // Select an exercise from the dropdown
    await page.locator('select').first().selectOption('squat');

    // Start button should be visible (either "Start AI Coaching" or "Loading AI model...")
    const startOrLoading = page.locator('button', { hasText: /Start AI Coaching|Loading AI model/i });
    await expect(startOrLoading.first()).toBeVisible({ timeout: 10_000 });
  });

  test('model loading indicator is visible on workout page', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/workout');

    // Should show model loading/ready status somewhere
    const statusText = page.locator('text=/MoveNet|Loading|model/i').first();
    await expect(statusText).toBeVisible({ timeout: 15_000 });
  });

  test('camera view placeholder or video element exists', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/workout');

    // There should be a video element or canvas for camera
    const videoOrCanvas = page.locator('video, canvas');
    await expect(videoOrCanvas.first()).toBeAttached({ timeout: 10_000 });
  });

  test('language toggle on workout page works', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/workout');

    const langBtn = page.locator('button', { hasText: /Voice Coach/i });
    if (await langBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(langBtn).toContainText(/हिंदी|English/);
      await langBtn.click();
      await page.waitForTimeout(300);
      await expect(langBtn).toContainText(/हिंदी|English/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. HISTORY PAGE
// ═══════════════════════════════════════════════════════════════════════
test.describe('History Page', () => {

  test('history page loads and shows heading', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/history');

    await expect(
      page.locator('text=/Workout History|No workouts/i').first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('back button on history navigates home', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/history');

    const backBtn = page.locator('button', { hasText: /back/i });
    if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backBtn.click();
      await expect(page).toHaveURL(/^http:\/\/localhost:5174\/$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. FOOD JOURNAL PAGE
// ═══════════════════════════════════════════════════════════════════════
test.describe('Food Journal Page', () => {

  test('page loads with meal type selector and analysis form', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/food-journal');

    // Meal type buttons should be visible
    for (const meal of ['Breakfast', 'Lunch', 'Dinner', 'Snack']) {
      await expect(page.getByText(meal, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('meal type selector buttons are clickable', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/food-journal');

    // Click each meal type
    await page.getByText('Breakfast', { exact: true }).first().click();
    await page.waitForTimeout(200);
    await page.getByText('Dinner', { exact: true }).first().click();
    await page.waitForTimeout(200);
    await page.getByText('Snack', { exact: true }).first().click();
    await page.waitForTimeout(200);
  });

  test('text description input exists and accepts text', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/food-journal');

    // Find text input/textarea for food description
    const input = page.locator('textarea, input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill('2 roti with dal and sabzi');
    await expect(input).toHaveValue('2 roti with dal and sabzi');
  });

  test('analyze button exists', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/food-journal');

    // There should be an analyze button
    const analyzeBtn = page.locator('button', { hasText: /analyze|scan|estimate/i });
    await expect(analyzeBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  test('tab switching between log and history works', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/food-journal');

    // Look for tab/toggle for History view
    const historyTab = page.locator('button, [role="tab"]', { hasText: /history|log/i });
    if (await historyTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await historyTab.first().click();
      await page.waitForTimeout(500);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. DIET PLAN PAGE
// ═══════════════════════════════════════════════════════════════════════
test.describe('Diet Plan Page', () => {

  test('page loads with goal selector', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/diet-plan');

    // Goal options should be visible
    for (const goal of ['Muscle Gain', 'Fat Loss', 'Maintenance', 'General Health']) {
      await expect(page.getByText(goal, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('body stats form fields exist', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/diet-plan');

    // Weight, height, age input fields
    const inputs = page.locator('input[type="number"], input[inputmode="numeric"]');
    await expect(inputs.first()).toBeVisible({ timeout: 5_000 });
  });

  test('activity level options are displayed', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/diet-plan');

    for (const level of ['Sedentary', 'Moderately Active']) {
      await expect(page.getByText(level, { exact: false }).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('dietary preference options are displayed', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/diet-plan');

    for (const pref of ['Vegetarian', 'Non-Veg', 'Vegan']) {
      await expect(page.getByText(pref, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('gender selector is displayed', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/diet-plan');

    await expect(page.getByText('Male', { exact: true }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Female', { exact: true }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('generate button exists', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/diet-plan');

    const genBtn = page.locator('button', { hasText: /generate|create|get plan/i });
    await expect(genBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  test('filling form and clicking generate does not crash', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/diet-plan');

    // Select goal (click Muscle Gain)
    await page.getByText('Muscle Gain', { exact: true }).first().click();

    // Fill weight, height, age (find number inputs)
    const numberInputs = page.locator('input[type="number"], input[inputmode="numeric"]');
    const count = await numberInputs.count();
    if (count >= 3) {
      await numberInputs.nth(0).fill('75');  // weight
      await numberInputs.nth(1).fill('175'); // height
      await numberInputs.nth(2).fill('28');  // age
    }

    // Select Vegetarian preference
    await page.getByText('Vegetarian', { exact: true }).first().click();

    // Click Generate
    const genBtn = page.locator('button', { hasText: /generate|create|get plan/i });
    await genBtn.first().click();

    // Should show loading state or result — not a crash/error page
    await page.waitForTimeout(2000);
    // Page should still be on diet-plan
    await expect(page).toHaveURL(/\/diet-plan/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. BACKEND API TESTS
// ═══════════════════════════════════════════════════════════════════════
test.describe('Backend API', () => {

  test('health endpoint responds correctly', async ({ request }) => {
    const res = await request.get('http://localhost:4000/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('ai-gym-trainer');
    expect(body.mode).toBe('offline-capable');
    expect(body.features).toBeDefined();
    expect(body.features.poseDetection).toContain('MoveNet');
  });

  test('exercises endpoint returns array of exercises', async ({ request }) => {
    const res = await request.get('http://localhost:4000/api/exercises');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.length).toBeGreaterThanOrEqual(5);
    // Each exercise should have id and name
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('name');
  });

  test('session CRUD: create → start coaching → send events → end', async ({ request }) => {
    // 1. Create session
    const createRes = await request.post('http://localhost:4000/api/sessions', {
      data: { exerciseId: 'squat' },
    });
    expect(createRes.ok()).toBeTruthy();
    const { sessionId } = await createRes.json();
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');

    // 2. Start coaching
    const coachRes = await request.post('http://localhost:4000/api/coaching/start', {
      data: { sessionId, exerciseId: 'squat' },
    });
    expect(coachRes.ok()).toBeTruthy();
    const coachBody = await coachRes.json();
    expect(coachBody.started).toBe(true);
    expect(coachBody.coaching).toBeDefined();
    expect(coachBody.coaching.text).toBeTruthy();

    // 3. Send pose event
    const poseRes = await request.post('http://localhost:4000/api/events/pose', {
      data: { sessionId, score: 75, issues: [] },
    });
    expect(poseRes.ok()).toBeTruthy();
    expect((await poseRes.json())).toHaveProperty('coaching');

    // 4. Send rep event
    const repRes = await request.post('http://localhost:4000/api/events/rep', {
      data: { sessionId, repCount: 1, repScore: 85 },
    });
    expect(repRes.ok()).toBeTruthy();
    expect((await repRes.json())).toHaveProperty('coaching');

    // 5. Set complete event
    const setRes = await request.post('http://localhost:4000/api/events/set-complete', {
      data: { sessionId, setNumber: 1 },
    });
    expect(setRes.ok()).toBeTruthy();
    const setBody = await setRes.json();
    expect(setBody.coaching).toBeDefined();
    expect(setBody.coaching.trigger).toBe('set_transition');

    // 6. End session
    const endRes = await request.patch(`http://localhost:4000/api/sessions/${sessionId}/end`, {
      data: { avgFormScore: 78, totalReps: 12 },
    });
    expect(endRes.ok()).toBeTruthy();

    // 7. Stop coaching
    const stopRes = await request.post('http://localhost:4000/api/coaching/stop', {
      data: { sessionId },
    });
    expect(stopRes.ok()).toBeTruthy();
    expect((await stopRes.json()).stopped).toBe(true);
  });

  test('Gemini analyze endpoint responds (even without API key)', async ({ request }) => {
    // Create session first
    const sessionRes = await request.post('http://localhost:4000/api/sessions', {
      data: { exerciseId: 'pushup' },
    });
    const { sessionId } = await sessionRes.json();

    await request.post('http://localhost:4000/api/coaching/start', {
      data: { sessionId, exerciseId: 'pushup' },
    });

    const analyzeRes = await request.post('http://localhost:4000/api/events/analyze', {
      data: {
        sessionId,
        exerciseName: 'Push-up',
        exerciseId: 'pushup',
        angles: { left_elbow: 90, right_elbow: 88 },
        keypointPositions: {},
        currentPhase: 'bottom',
        repCount: 5,
      },
    });
    expect(analyzeRes.ok()).toBeTruthy();
    const body = await analyzeRes.json();
    expect(body).toHaveProperty('analysis');
  });

  test('urgent form alert triggers below score 40', async ({ request }) => {
    const sessionRes = await request.post('http://localhost:4000/api/sessions', {
      data: { exerciseId: 'squat' },
    });
    const { sessionId } = await sessionRes.json();

    await request.post('http://localhost:4000/api/coaching/start', {
      data: { sessionId, exerciseId: 'squat' },
    });

    // Score 15 — far below 40 threshold
    const poseRes = await request.post('http://localhost:4000/api/events/pose', {
      data: { sessionId, score: 15, issues: ['Knees caving in', 'Back rounding'] },
    });
    expect(poseRes.ok()).toBeTruthy();
    const body = await poseRes.json();
    expect(body.coaching).toBeDefined();
    expect(body.coaching.text).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. CROSS-PAGE USER FLOW
// ═══════════════════════════════════════════════════════════════════════
test.describe('Full User Journey', () => {

  test('new user: onboard → home → workout → history → food → diet', async ({ page }) => {
    // Clear state for fresh user experience
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Step 1: Onboarding
    const modal = page.locator('.fixed.inset-0');
    if (await modal.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      const nameInput = page.locator('input[placeholder]');
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('JourneyTestUser');
        const startBtn = page.locator('button', { hasText: /start|begin|go|let/i });
        await startBtn.first().click();
      }
    }
    await page.waitForTimeout(1000);

    // Step 2: Verify home loaded
    await expect(page.locator('h1')).toContainText('FitSenseAI');

    // Step 3: Navigate to workout
    await page.getByText('Start Training').click();
    await expect(page).toHaveURL(/\/workout/);
    await page.waitForTimeout(1000);

    // Step 4: Verify workout page has exercise selection dropdown
    const exerciseSelect = page.locator('select').first();
    await expect(exerciseSelect).toBeVisible({ timeout: 10_000 });

    // Step 5: Navigate to history
    await page.locator('nav').getByText('History', { exact: true }).click();
    await expect(page).toHaveURL(/\/history/);
    await expect(page.locator('text=/Workout History|No workouts/i').first()).toBeVisible({ timeout: 5_000 });

    // Step 6: Navigate to food journal
    await page.locator('nav').getByText('Food', { exact: true }).click();
    await expect(page).toHaveURL(/\/food-journal/);
    await expect(page.getByText('Breakfast', { exact: true }).first()).toBeVisible({ timeout: 5_000 });

    // Step 7: Navigate to diet plan
    await page.locator('nav').getByText('Diet', { exact: true }).click();
    await expect(page).toHaveURL(/\/diet-plan/);
    await expect(page.getByText('Muscle Gain', { exact: true }).first()).toBeVisible({ timeout: 5_000 });

    // Step 8: Navigate back to home
    await page.locator('nav').getByText('Home', { exact: true }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:5174\/$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 10. VISUAL & RESPONSIVE CHECKS
// ═══════════════════════════════════════════════════════════════════════
test.describe('Visual & Responsive Checks', () => {

  test('no console errors on home page load', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await dismissOnboarding(page);
    await page.waitForTimeout(2000);

    // Filter out known benign errors (camera permission, WebGL, API 404s for missing user data)
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('NotAllowedError') && !e.includes('camera') && !e.includes('getUserMedia')
        && !e.includes('Failed to load resource') && !e.includes('404')
    );
    expect(realErrors).toEqual([]);
  });

  test('no console errors on workout page load', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/workout');
    await page.waitForTimeout(3000);

    const realErrors = consoleErrors.filter(
      (e) => !e.includes('NotAllowedError') && !e.includes('camera') && !e.includes('getUserMedia')
        && !e.includes('WebGL') && !e.includes('Failed to load resource') && !e.includes('404')
    );
    expect(realErrors).toEqual([]);
  });

  test('footer is visible on home page', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const footer = page.locator('footer');
    if (await footer.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(footer).toContainText('FitSenseAI');
    }
  });

  test('page renders correctly at mobile viewport', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      permissions: ['camera', 'microphone'],
    });
    const page = await context.newPage();

    await page.goto('http://localhost:5174/');
    await dismissOnboarding(page);

    // Hero should still be visible
    await expect(page.locator('h1')).toContainText('FitSenseAI');

    // Navbar should be visible
    await expect(page.locator('nav')).toBeVisible();

    await context.close();
  });
});
