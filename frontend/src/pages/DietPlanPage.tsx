/**
 * DietPlanPage — AI-generated personalized Indian diet plans.
 *
 * Features:
 *  - Goal selector (muscle gain / fat loss / maintenance / general health)
 *  - Body stats input (weight, height, age, gender, activity level)
 *  - Dietary preference selector (vegetarian / non-veg / vegan / eggetarian)
 *  - Gemini-powered meal plan generation with Indian cuisine focus
 *  - Meal schedule with time, items, macros, Hindi names
 *  - Active plan display with macro targets
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function getUserId(): string | null {
  return localStorage.getItem('gym-userId');
}

/* ─── Types ─── */

interface MealItem {
  name: string;
  nameHindi?: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Meal {
  time: string;
  mealType: string;
  name: string;
  nameHindi?: string;
  items: MealItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  notes?: string;
}

interface DietPlan {
  id: string;
  goal: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  planJson: string;
  aiRationale: string;
  isActive: boolean;
  createdAt: string;
}

interface ParsedPlan {
  meals: Meal[];
  rationale: string;
}

/* ─── Config Options ─── */

const GOALS = [
  { id: 'muscle_gain', label: 'Muscle Gain', labelHi: 'मांसपेशी बढ़ाना', icon: '💪', desc: 'High protein, calorie surplus' },
  { id: 'fat_loss', label: 'Fat Loss', labelHi: 'वज़न कम करना', icon: '🔥', desc: 'Calorie deficit, high protein' },
  { id: 'maintenance', label: 'Maintenance', labelHi: 'बनाए रखना', icon: '⚖️', desc: 'Balanced nutrition' },
  { id: 'general_health', label: 'General Health', labelHi: 'सामान्य स्वास्थ्य', icon: '🌿', desc: 'Nutrient-dense whole foods' },
];

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise' },
  { id: 'light', label: 'Lightly Active', desc: '1-3 days/week exercise' },
  { id: 'moderate', label: 'Moderately Active', desc: '3-5 days/week exercise' },
  { id: 'active', label: 'Very Active', desc: '6-7 days/week exercise' },
  { id: 'athlete', label: 'Athlete', desc: 'Intense training daily' },
];

const DIET_PREFS = [
  { id: 'vegetarian', label: 'Vegetarian', icon: '🥬' },
  { id: 'non_vegetarian', label: 'Non-Veg', icon: '🍗' },
  { id: 'eggetarian', label: 'Eggetarian', icon: '🥚' },
  { id: 'vegan', label: 'Vegan', icon: '🌱' },
];

const GENDER_OPTIONS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];

/* ─── Component ─── */

export function DietPlanPage() {
  const userId = getUserId();

  // Form state
  const [goal, setGoal] = useState('muscle_gain');
  const [weight, setWeight] = useState('70');
  const [height, setHeight] = useState('170');
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState('male');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [dietPreference, setDietPreference] = useState('vegetarian');
  const [allergies, setAllergies] = useState('');

  // Plan state
  const [generating, setGenerating] = useState(false);
  const [activePlan, setActivePlan] = useState<DietPlan | null>(null);
  const [parsedPlan, setParsedPlan] = useState<ParsedPlan | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'plan'>('create');

  /* ─── Fetch active plan ─── */

  const fetchActivePlan = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/api/diet/active/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.plan) {
          setActivePlan(data.plan);
          // Backend returns meals already parsed alongside planJson
          const meals = data.plan.meals || (() => {
            try { const p = JSON.parse(data.plan.planJson); return Array.isArray(p) ? p : (p.meals || []); }
            catch { return []; }
          })();
          setParsedPlan({
            meals,
            rationale: data.plan.aiRationale || '',
          });
          setActiveTab('plan');
        }
      }
    } catch { /* offline */ }
  }, [userId]);

  useEffect(() => {
    fetchActivePlan();
  }, [fetchActivePlan]);

  /* ─── Generate plan ─── */

  async function handleGenerate() {
    if (!userId) return;

    // Validate inputs — parseFloat('') returns NaN
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age);
    if (!w || w <= 0 || !h || h <= 0 || !a || a <= 0) {
      alert('Please enter valid weight, height, and age values.');
      return;
    }

    setGenerating(true);

    try {
      const res = await fetch(`${API_BASE}/api/diet/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          goal,
          weightKg: parseFloat(weight),
          heightCm: parseFloat(height),
          age: parseInt(age),
          gender,
          activityLevel,
          dietaryPreferences: dietPreference,
          allergies: allergies.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActivePlan(data.plan);
        // Backend returns meals already parsed alongside planJson
        const meals = data.plan?.meals || (() => {
          try { const p = JSON.parse(data.plan?.planJson || '[]'); return Array.isArray(p) ? p : (p.meals || []); }
          catch { return []; }
        })();
        if (meals.length > 0) {
          setParsedPlan({
            meals,
            rationale: data.plan?.aiRationale || '',
          });
        } else {
          setParsedPlan(null);
          alert('Plan was generated but the response format is invalid. Try regenerating.');
        }
        setActiveTab('plan');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to generate plan. Try again.');
      }
    } catch {
      alert('Network error. Check your connection.');
    } finally {
      setGenerating(false);
    }
  }

  /* ─── No user fallback ─── */

  if (!userId) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="text-4xl mb-4">🥗</div>
          <h2 className="text-white font-bold text-xl mb-2">Diet Plan</h2>
          <p className="text-white/40 text-sm mb-6">Create a profile first to generate personalized diet plans.</p>
          <Link to="/" className="btn-glow inline-block">Go to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <span className="text-2xl">🥗</span>
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Diet Plan</h1>
          <p className="text-white/30 text-sm">AI-powered Indian meal planning • डाइट प्लान</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6">
        {(['create', 'plan'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeTab === tab
                ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/15 text-white border border-emerald-500/30'
                : 'text-white/40 bg-white/[0.03] border border-white/[0.06] hover:text-white/60'
            }`}
          >
            {tab === 'create' ? '⚙️ Configure' : '📋 My Plan'}
          </button>
        ))}
      </div>

      {activeTab === 'create' ? (
        <div className="space-y-6">
          {/* ─── Goal Selector ─── */}
          <div className="glass-card p-5 border border-white/[0.06]">
            <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">Your Goal • लक्ष्य</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className={`p-4 rounded-xl text-center transition-all duration-200 ${
                    goal === g.id
                      ? 'bg-gradient-to-b from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                      : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="text-2xl block mb-2">{g.icon}</span>
                  <span className={`text-xs font-bold block ${goal === g.id ? 'text-emerald-400' : 'text-white/50'}`}>
                    {g.label}
                  </span>
                  <span className="text-[10px] text-white/20 block mt-0.5">{g.labelHi}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ─── Body Stats ─── */}
          <div className="glass-card p-5 border border-white/[0.06]">
            <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">Body Stats • शरीर विवरण</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase mb-1 block">Weight (kg)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-emerald-500/40"
                />
              </div>
              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase mb-1 block">Height (cm)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-emerald-500/40"
                />
              </div>
              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase mb-1 block">Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-emerald-500/40"
                />
              </div>
              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase mb-1 block">Gender</label>
                <div className="flex gap-2">
                  {GENDER_OPTIONS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGender(g.id)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        gender === g.id
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/[0.05] text-white/40 border border-white/[0.08] hover:text-white/60'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Activity Level ─── */}
          <div className="glass-card p-5 border border-white/[0.06]">
            <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">Activity Level</h3>
            <div className="space-y-2">
              {ACTIVITY_LEVELS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setActivityLevel(a.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                    activityLevel === a.id
                      ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-500/30'
                      : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05]'
                  }`}
                >
                  <span className={`text-sm font-bold ${activityLevel === a.id ? 'text-emerald-400' : 'text-white/50'}`}>
                    {a.label}
                  </span>
                  <span className="text-white/20 text-xs">{a.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ─── Dietary Preference ─── */}
          <div className="glass-card p-5 border border-white/[0.06]">
            <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">Diet Preference • खानपान</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DIET_PREFS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDietPreference(d.id)}
                  className={`p-3 rounded-xl text-center transition-all duration-200 ${
                    dietPreference === d.id
                      ? 'bg-gradient-to-b from-emerald-500/20 to-teal-500/10 border border-emerald-500/30'
                      : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="text-2xl block mb-1">{d.icon}</span>
                  <span className={`text-xs font-bold ${dietPreference === d.id ? 'text-emerald-400' : 'text-white/50'}`}>
                    {d.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ─── Allergies ─── */}
          <div className="glass-card p-5 border border-white/[0.06]">
            <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">
              Allergies / Restrictions <span className="text-white/20">(optional)</span>
            </h3>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="e.g., lactose, gluten, nuts..."
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/15 focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 transition-all text-sm"
            />
          </div>

          {/* ─── Generate Button ─── */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-all duration-300 ${
              generating
                ? 'bg-emerald-500/30 text-emerald-300 cursor-wait'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_8px_32px_rgba(52,211,153,0.3)] hover:shadow-[0_12px_48px_rgba(52,211,153,0.5)] hover:-translate-y-1 active:translate-y-0'
            }`}
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
                Generating your plan...
              </span>
            ) : (
              '🤖 Generate My Diet Plan'
            )}
          </button>
        </div>
      ) : (
        /* ─── PLAN TAB ─── */
        <div className="space-y-6">
          {!activePlan || !parsedPlan ? (
            <div className="glass-card p-10 text-center border border-white/[0.06]">
              <span className="text-4xl block mb-3">🥗</span>
              <h3 className="text-white font-bold mb-2">No Active Plan</h3>
              <p className="text-white/30 text-sm mb-4">Configure your preferences and generate a personalized diet plan!</p>
              <button
                onClick={() => setActiveTab('create')}
                className="btn-glow"
              >
                Create Plan
              </button>
            </div>
          ) : (
            <>
              {/* ─── Plan Header ─── */}
              <div className="glass-card p-5 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{GOALS.find((g) => g.id === activePlan.goal)?.icon || '🎯'}</span>
                    <h3 className="text-white font-bold">
                      {GOALS.find((g) => g.id === activePlan.goal)?.label || activePlan.goal}
                    </h3>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <span className="text-white/20 text-xs">
                    {new Date(activePlan.createdAt).toLocaleDateString('en-IN')}
                  </span>
                </div>

                {/* Macro Targets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <TargetCard
                    label="Calories"
                    value={activePlan.targetCalories}
                    unit="kcal"
                    color="amber"
                  />
                  <TargetCard
                    label="Protein"
                    value={activePlan.targetProtein}
                    unit="g"
                    color="cyan"
                  />
                  <TargetCard
                    label="Carbs"
                    value={activePlan.targetCarbs}
                    unit="g"
                    color="emerald"
                  />
                  <TargetCard
                    label="Fat"
                    value={activePlan.targetFat}
                    unit="g"
                    color="rose"
                  />
                </div>
              </div>

              {/* ─── AI Rationale ─── */}
              {parsedPlan.rationale && (
                <div className="glass-card p-5 border border-violet-500/20">
                  <h3 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                    <span className="text-violet-400">🧠</span> AI Rationale
                  </h3>
                  <p className="text-white/40 text-sm leading-relaxed">{parsedPlan.rationale}</p>
                </div>
              )}

              {/* ─── Meals ─── */}
              <div className="space-y-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <span className="text-emerald-400">🍽️</span> Daily Meal Schedule
                </h3>

                {parsedPlan.meals.map((meal, i) => (
                  <div key={i} className="glass-card p-5 border border-white/[0.06] hover:border-emerald-500/20 transition-colors">
                    {/* Meal header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-white font-bold text-sm">{meal.name}</span>
                        {meal.nameHindi && (
                          <span className="text-emerald-400/60 text-xs ml-2">({meal.nameHindi})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/20 text-xs">⏰ {meal.time}</span>
                        <span className="px-2 py-0.5 rounded-lg bg-white/[0.05] text-white/30 text-[10px] font-bold uppercase">
                          {meal.mealType}
                        </span>
                      </div>
                    </div>

                    {/* Items — backend returns string[] OR MealItem[], handle both */}
                    <div className="space-y-1.5 mb-3">
                      {meal.items.map((item: MealItem | string, j: number) => {
                        // Backend returns items as string[] (e.g., "1 cup oats")
                        // Frontend type expects MealItem objects — handle both
                        const isString = typeof item === 'string';
                        const displayName = isString ? item : item.name;
                        const displayHindi = isString ? undefined : item.nameHindi;
                        const displayPortion = isString ? undefined : item.portion;
                        const displayCal = isString ? undefined : item.calories;
                        const displayProtein = isString ? undefined : item.protein;

                        return (
                          <div key={j} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02]">
                            <div className="flex items-center gap-2">
                              <span className="text-white/60 text-sm">{displayName}</span>
                              {displayHindi && (
                                <span className="text-emerald-400/40 text-xs">({displayHindi})</span>
                              )}
                              {displayPortion && (
                                <span className="text-white/15 text-xs">{displayPortion}</span>
                              )}
                            </div>
                            {displayCal !== undefined && (
                              <div className="flex gap-2 text-xs">
                                <span className="text-amber-400 font-mono">{displayCal}cal</span>
                                <span className="text-cyan-400/60 font-mono">{displayProtein}gP</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Meal totals — backend uses calories/protein/carbs/fat, frontend type uses totalCalories etc. */}
                    <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
                      <span className="text-amber-400 text-xs font-mono font-bold">{(meal as any).calories ?? meal.totalCalories} cal</span>
                      <span className="text-cyan-400 text-xs font-mono">{(meal as any).protein ?? meal.totalProtein}g P</span>
                      <span className="text-emerald-400 text-xs font-mono">{(meal as any).carbs ?? meal.totalCarbs}g C</span>
                      <span className="text-rose-400 text-xs font-mono">{(meal as any).fat ?? meal.totalFat}g F</span>
                      {meal.notes && (
                        <span className="text-white/15 text-xs ml-auto italic">{meal.notes}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ─── Regenerate ─── */}
              <button
                onClick={() => setActiveTab('create')}
                className="w-full py-3.5 rounded-xl font-bold text-white/50 bg-white/[0.04] border border-white/[0.08] hover:text-white hover:bg-white/[0.08] transition-all"
              >
                🔄 Generate New Plan
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function TargetCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    amber: { bg: 'from-amber-500/15 to-amber-500/5 border-amber-500/20', text: 'text-amber-400' },
    cyan: { bg: 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/20', text: 'text-cyan-400' },
    emerald: { bg: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20', text: 'text-emerald-400' },
    rose: { bg: 'from-rose-500/15 to-rose-500/5 border-rose-500/20', text: 'text-rose-400' },
  };
  const s = styles[color] || styles.amber;

  return (
    <div className={`glass-card p-3 bg-gradient-to-b ${s.bg} border text-center`}>
      <div className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-black font-mono ${s.text} leading-none`}>{Math.round(value)}</div>
      <div className="text-[10px] text-white/20 mt-0.5">{unit}/day</div>
    </div>
  );
}
