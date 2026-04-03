/**
 * Diet Planner Service — Algorithm-based Indian diet plan generation.
 *
 * Uses standard nutrition formulas (Mifflin-St Jeor BMR, TDEE) to calculate
 * caloric/macro targets, then selects meals from a local Indian food database
 * to build a personalized daily plan.
 *
 * Zero external API calls — works completely offline.
 */

export interface DietPlanInput {
  goal: string;
  weightKg?: number;
  heightCm?: number;
  age?: number;
  gender?: string;
  activityLevel?: string;
  dietaryPreferences?: string;
  allergies?: string;
  recentFoodLogs?: Array<{
    description: string | null;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    mealType: string;
  }>;
  recentWorkouts?: Array<{
    exerciseId: string;
    totalReps: number | null;
    avgFormScore: number | null;
  }>;
}

export interface MealPlanItem {
  time: string;        // "7:00 AM"
  mealType: string;    // breakfast | mid_morning | lunch | evening_snack | dinner | bedtime
  name: string;        // "Paneer Paratha with Curd"
  nameHindi?: string;  // "पनीर पराठा दही के साथ"
  items: string[];     // ["2 paneer parathas", "1 bowl curd", "1 glass lassi"]
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;      // "Good pre-workout meal — eat 1 hour before gym"
}

export interface DietPlanResult {
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  meals: MealPlanItem[];
  rationale: string;
}

// ── Activity Multipliers (Harris-Benedict) ────────────────
const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// ── Meal Templates (Indian cuisine) ──────────────────────

interface MealTemplate {
  time: string;
  mealType: string;
  name: string;
  nameHindi?: string;
  items: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;
  tags: string[]; // 'veg', 'non-veg', 'egg', 'high-protein', 'low-cal'
}

const BREAKFAST_OPTIONS: MealTemplate[] = [
  { time: '7:00 AM', mealType: 'breakfast', name: 'Oats with Milk & Banana', nameHindi: 'दूध और केले के साथ ओट्स', items: ['1 cup oats', '200ml milk', '1 banana', '5 almonds'], calories: 380, protein: 15, carbs: 55, fat: 10, tags: ['veg'] },
  { time: '7:00 AM', mealType: 'breakfast', name: 'Egg Bhurji with Toast', nameHindi: 'अंडा भुर्जी टोस्ट', items: ['3 eggs scrambled', '2 wheat bread slices', '1 cup chai'], calories: 400, protein: 22, carbs: 30, fat: 20, tags: ['egg', 'high-protein'] },
  { time: '7:00 AM', mealType: 'breakfast', name: 'Moong Dal Cheela', nameHindi: 'मूंग दाल चीला', items: ['2 cheela', '1 bowl curd', 'mint chutney'], calories: 320, protein: 18, carbs: 35, fat: 10, tags: ['veg', 'high-protein'] },
  { time: '7:00 AM', mealType: 'breakfast', name: 'Poha with Peanuts', nameHindi: 'मूंगफली पोहा', items: ['1 plate poha', 'handful peanuts', '1 cup chai'], calories: 350, protein: 10, carbs: 48, fat: 12, tags: ['veg'] },
  { time: '7:00 AM', mealType: 'breakfast', name: 'Idli Sambar', nameHindi: 'इडली सांभर', items: ['3 idli', '1 bowl sambar', 'coconut chutney'], calories: 300, protein: 10, carbs: 50, fat: 5, notes: 'Light and easy to digest', tags: ['veg', 'low-cal'] },
  { time: '7:00 AM', mealType: 'breakfast', name: 'Paneer Paratha with Curd', nameHindi: 'पनीर पराठा दही', items: ['2 paneer parathas', '1 bowl curd'], calories: 520, protein: 22, carbs: 50, fat: 24, tags: ['veg', 'high-protein'] },
  { time: '7:00 AM', mealType: 'breakfast', name: 'Protein Oats Shake', nameHindi: 'प्रोटीन ओट्स शेक', items: ['1 cup oats', '1 scoop whey', '1 banana', '200ml milk'], calories: 450, protein: 35, carbs: 50, fat: 10, notes: 'Best pre-workout breakfast', tags: ['veg', 'high-protein'] },
];

const MID_MORNING_OPTIONS: MealTemplate[] = [
  { time: '10:00 AM', mealType: 'mid_morning', name: 'Sprouts Chaat', nameHindi: 'अंकुरित चाट', items: ['1 bowl moong sprouts', 'onion', 'lemon', 'chaat masala'], calories: 150, protein: 10, carbs: 20, fat: 3, tags: ['veg', 'high-protein'] },
  { time: '10:00 AM', mealType: 'mid_morning', name: 'Fruit & Nuts', nameHindi: 'फल और मेवा', items: ['1 banana', '1 apple', '10 almonds'], calories: 280, protein: 6, carbs: 42, fat: 10, tags: ['veg'] },
  { time: '10:00 AM', mealType: 'mid_morning', name: 'Boiled Eggs', nameHindi: 'उबले अंडे', items: ['2 boiled eggs', '1 glass nimbu pani'], calories: 190, protein: 13, carbs: 12, fat: 10, tags: ['egg', 'high-protein'] },
  { time: '10:00 AM', mealType: 'mid_morning', name: 'Buttermilk & Peanuts', nameHindi: 'छाछ और मूंगफली', items: ['1 glass chaas', '1 handful peanuts'], calories: 210, protein: 10, carbs: 9, fat: 15, tags: ['veg'] },
];

const LUNCH_OPTIONS: MealTemplate[] = [
  { time: '1:00 PM', mealType: 'lunch', name: 'Dal, Rice & Sabzi', nameHindi: 'दाल चावल और सब्ज़ी', items: ['1 bowl dal', '1 bowl rice', '1 bowl mixed sabzi', '2 rotis', '1 bowl curd'], calories: 580, protein: 22, carbs: 80, fat: 15, tags: ['veg'] },
  { time: '1:00 PM', mealType: 'lunch', name: 'Chicken Curry with Rice', nameHindi: 'चिकन करी चावल', items: ['1 serving chicken curry', '1 bowl rice', '1 bowl salad'], calories: 520, protein: 32, carbs: 52, fat: 18, tags: ['non-veg', 'high-protein'] },
  { time: '1:00 PM', mealType: 'lunch', name: 'Rajma Chawal', nameHindi: 'राजमा चावल', items: ['1 bowl rajma', '1 bowl rice', '1 bowl raita', 'salad'], calories: 500, protein: 18, carbs: 72, fat: 12, tags: ['veg'] },
  { time: '1:00 PM', mealType: 'lunch', name: 'Chole with Roti', nameHindi: 'छोले रोटी', items: ['1 bowl chole', '3 rotis', '1 bowl curd', 'onion salad'], calories: 560, protein: 20, carbs: 75, fat: 16, tags: ['veg'] },
  { time: '1:00 PM', mealType: 'lunch', name: 'Fish Curry with Rice', nameHindi: 'मछली करी चावल', items: ['1 serving fish curry', '1 bowl rice', '1 bowl dal', 'salad'], calories: 530, protein: 30, carbs: 60, fat: 16, tags: ['non-veg', 'high-protein'] },
  { time: '1:00 PM', mealType: 'lunch', name: 'Egg Curry with Roti', nameHindi: 'अंडा करी रोटी', items: ['2 egg curry', '3 rotis', '1 bowl salad'], calories: 500, protein: 20, carbs: 62, fat: 18, tags: ['egg'] },
];

const EVENING_SNACK_OPTIONS: MealTemplate[] = [
  { time: '4:00 PM', mealType: 'evening_snack', name: 'Peanut Butter Toast', nameHindi: 'पीनट बटर टोस्ट', items: ['2 wheat bread slices', '2 tbsp peanut butter', '1 glass milk'], calories: 350, protein: 16, carbs: 35, fat: 18, notes: 'Good pre-evening workout snack', tags: ['veg', 'high-protein'] },
  { time: '4:00 PM', mealType: 'evening_snack', name: 'Protein Shake', nameHindi: 'प्रोटीन शेक', items: ['1 scoop whey protein', '200ml milk', '1 banana'], calories: 300, protein: 32, carbs: 32, fat: 6, notes: 'Post-workout recovery', tags: ['veg', 'high-protein'] },
  { time: '4:00 PM', mealType: 'evening_snack', name: 'Roasted Chana & Chai', nameHindi: 'भुने चने और चाय', items: ['1 bowl roasted chana', '1 cup masala chai'], calories: 230, protein: 10, carbs: 30, fat: 7, tags: ['veg'] },
  { time: '4:00 PM', mealType: 'evening_snack', name: 'Banana Shake', nameHindi: 'केले का शेक', items: ['2 bananas', '250ml milk', '1 tbsp honey'], calories: 320, protein: 10, carbs: 56, fat: 6, tags: ['veg'] },
];

const DINNER_OPTIONS: MealTemplate[] = [
  { time: '8:00 PM', mealType: 'dinner', name: 'Paneer Bhurji with Roti', nameHindi: 'पनीर भुर्जी रोटी', items: ['150g paneer bhurji', '2 rotis', '1 bowl salad'], calories: 450, protein: 24, carbs: 40, fat: 20, tags: ['veg', 'high-protein'] },
  { time: '8:00 PM', mealType: 'dinner', name: 'Palak Paneer with Roti', nameHindi: 'पालक पनीर रोटी', items: ['1 bowl palak paneer', '2 rotis', '1 bowl raita'], calories: 480, protein: 22, carbs: 42, fat: 24, tags: ['veg', 'high-protein'] },
  { time: '8:00 PM', mealType: 'dinner', name: 'Chicken Tikka with Roti', nameHindi: 'चिकन टिक्का रोटी', items: ['6 pieces chicken tikka', '2 rotis', 'green chutney', 'salad'], calories: 440, protein: 38, carbs: 40, fat: 14, tags: ['non-veg', 'high-protein'] },
  { time: '8:00 PM', mealType: 'dinner', name: 'Dal Tadka with Rice', nameHindi: 'दाल तड़का चावल', items: ['1 bowl dal tadka', '1 bowl rice', '1 bowl sabzi', 'salad'], calories: 420, protein: 16, carbs: 60, fat: 12, tags: ['veg'] },
  { time: '8:00 PM', mealType: 'dinner', name: 'Egg Omelette with Roti', nameHindi: 'ऑमलेट रोटी', items: ['3-egg omelette with veggies', '2 rotis', '1 bowl curd'], calories: 430, protein: 24, carbs: 40, fat: 18, tags: ['egg', 'high-protein'] },
  { time: '8:00 PM', mealType: 'dinner', name: 'Moong Dal Khichdi', nameHindi: 'मूंग दाल खिचड़ी', items: ['1 bowl khichdi', '1 tbsp ghee', '1 bowl curd', 'papad'], calories: 380, protein: 14, carbs: 52, fat: 12, notes: 'Light dinner option', tags: ['veg'] },
];

const BEDTIME_OPTIONS: MealTemplate[] = [
  { time: '10:00 PM', mealType: 'bedtime', name: 'Warm Turmeric Milk', nameHindi: 'हल्दी दूध', items: ['1 glass warm milk', '1/2 tsp turmeric', '1 tsp honey'], calories: 130, protein: 8, carbs: 15, fat: 5, notes: 'Helps with recovery and sleep', tags: ['veg'] },
  { time: '10:00 PM', mealType: 'bedtime', name: 'Milk with Almonds', nameHindi: 'बादाम दूध', items: ['1 glass warm milk', '5 soaked almonds'], calories: 200, protein: 11, carbs: 14, fat: 11, tags: ['veg'] },
  { time: '10:00 PM', mealType: 'bedtime', name: 'Curd Bowl', nameHindi: 'दही', items: ['1 bowl plain curd'], calories: 120, protein: 7, carbs: 9, fat: 6, tags: ['veg'] },
];


// ── Nutrition Science Engine ─────────────────────────────

/**
 * Calculate BMR using Mifflin-St Jeor equation (most accurate for general population).
 * Male: 10×weight(kg) + 6.25×height(cm) - 5×age - 5
 * Female: 10×weight(kg) + 6.25×height(cm) - 5×age - 161
 */
function calculateBMR(weightKg: number, heightCm: number, age: number, gender: string): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'female' ? base - 161 : base - 5;
}

function calculateTDEE(bmr: number, activityLevel: string): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS['moderate'];
  return Math.round(bmr * multiplier);
}

function calculateTargets(tdee: number, weightKg: number, goal: string): { calories: number; protein: number; carbs: number; fat: number } {
  let calories: number;
  let proteinPerKg: number;

  switch (goal) {
    case 'muscle_gain':
      calories = tdee + 400;
      proteinPerKg = 2.0;
      break;
    case 'fat_loss':
      calories = tdee - 500;
      proteinPerKg = 2.2; // Higher protein preserves muscle during deficit
      break;
    case 'maintenance':
      calories = tdee;
      proteinPerKg = 1.6;
      break;
    default: // general_health
      calories = tdee;
      proteinPerKg = 1.4;
  }

  const protein = Math.round(weightKg * proteinPerKg);
  const fat = Math.round((calories * 0.25) / 9); // 25% of calories from fat
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories: Math.round(calories), protein, carbs: Math.max(carbs, 100), fat };
}


// ── Meal Selection Algorithm ─────────────────────────────

function isDietCompatible(meal: MealTemplate, preference: string, allergies: string): boolean {
  const pref = (preference || 'non-vegetarian').toLowerCase();
  const allergyList = (allergies || '').toLowerCase();

  // Diet preference filter
  if (pref.includes('veg') && !pref.includes('non')) {
    if (meal.tags.includes('non-veg') || meal.tags.includes('egg')) return false;
  }
  if (pref.includes('egg')) {
    if (meal.tags.includes('non-veg')) return false;
  }
  if (pref.includes('vegan')) {
    if (meal.tags.includes('non-veg') || meal.tags.includes('egg')) return false;
    // Also filter dairy — check items
    if (meal.items.some(i => /milk|curd|paneer|ghee|butter|cheese|whey|dahi|raita|lassi/i.test(i))) return false;
  }

  // Allergy filter — simple keyword check
  if (allergyList) {
    const mealText = [...meal.items, meal.name].join(' ').toLowerCase();
    const allergenWords = allergyList.split(/[,\s]+/).filter(a => a.length > 2);
    if (allergenWords.some(a => mealText.includes(a))) return false;
  }

  return true;
}

function selectBestMeal(
  options: MealTemplate[],
  targetCals: number,
  preference: string,
  allergies: string,
  preferHighProtein: boolean,
): MealTemplate {
  const compatible = options.filter(m => isDietCompatible(m, preference, allergies));
  if (compatible.length === 0) return options[0]; // Fallback

  // Score meals by how close they are to target calories + protein preference
  const scored = compatible.map(meal => {
    let score = 100 - Math.abs(meal.calories - targetCals); // Closer to target = better
    if (preferHighProtein && meal.tags.includes('high-protein')) score += 30;
    return { meal, score };
  });

  scored.sort((a, b) => b.score - a.score);
  // Pick from top 3 randomly for variety
  const topN = scored.slice(0, Math.min(3, scored.length));
  return topN[Math.floor(Math.random() * topN.length)].meal;
}


// ── Public API ────────────────────────────────────────────

export async function generateDietPlan(input: DietPlanInput): Promise<DietPlanResult> {
  const weight = input.weightKg || 70;
  const height = input.heightCm || 170;
  const age = input.age || 25;
  const gender = (input.gender || 'male').toLowerCase();
  const activity = (input.activityLevel || 'moderate').toLowerCase();

  // Step 1: Calculate caloric/macro targets
  const bmr = calculateBMR(weight, height, age, gender);
  const tdee = calculateTDEE(bmr, activity);
  const targets = calculateTargets(tdee, weight, input.goal || 'general_health');

  // Step 2: Distribute calories across meals (approximate %)
  const isHighCal = targets.calories > 2500;
  const breakfastCal = Math.round(targets.calories * 0.22);
  const midMorningCal = Math.round(targets.calories * 0.08);
  const lunchCal = Math.round(targets.calories * 0.30);
  const eveningCal = Math.round(targets.calories * (isHighCal ? 0.15 : 0.12));
  const dinnerCal = Math.round(targets.calories * 0.22);

  const preference = input.dietaryPreferences || 'non-vegetarian';
  const allergies = input.allergies || '';
  const preferProtein = input.goal === 'muscle_gain' || input.goal === 'fat_loss';

  // Step 3: Select meals
  const breakfast = selectBestMeal(BREAKFAST_OPTIONS, breakfastCal, preference, allergies, preferProtein);
  const midMorning = selectBestMeal(MID_MORNING_OPTIONS, midMorningCal, preference, allergies, preferProtein);
  const lunch = selectBestMeal(LUNCH_OPTIONS, lunchCal, preference, allergies, preferProtein);
  const evening = selectBestMeal(EVENING_SNACK_OPTIONS, eveningCal, preference, allergies, preferProtein);
  const dinner = selectBestMeal(DINNER_OPTIONS, dinnerCal, preference, allergies, preferProtein);
  const bedtime = selectBestMeal(BEDTIME_OPTIONS, 150, preference, allergies, false);

  const meals: MealPlanItem[] = [breakfast, midMorning, lunch, evening, dinner, bedtime].map(m => ({
    time: m.time,
    mealType: m.mealType,
    name: m.name,
    nameHindi: m.nameHindi,
    items: m.items,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    notes: m.notes,
  }));

  // Build rationale
  const goalLabels: Record<string, string> = {
    muscle_gain: 'muscle building (caloric surplus +400 kcal)',
    fat_loss: 'fat loss (caloric deficit -500 kcal)',
    maintenance: 'weight maintenance',
    general_health: 'general health & balanced nutrition',
  };

  const rationale = [
    `BMR: ${Math.round(bmr)} kcal (Mifflin-St Jeor formula).`,
    `TDEE: ${tdee} kcal (${activity} activity level).`,
    `Goal: ${goalLabels[input.goal] || 'general health'}.`,
    `Target: ${targets.calories} kcal, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat.`,
    `Plan customized for ${preference} ${allergies ? `(avoiding: ${allergies})` : ''} Indian diet.`,
  ].join(' ');

  return {
    targetCalories: targets.calories,
    targetProtein: targets.protein,
    targetCarbs: targets.carbs,
    targetFat: targets.fat,
    meals,
    rationale,
  };
}

/** Fallback diet plan when Gemini is unavailable */
function getDefaultIndianPlan(): DietPlanResult {
  return {
    targetCalories: 2000,
    targetProtein: 80,
    targetCarbs: 260,
    targetFat: 65,
    rationale: 'Default balanced Indian diet plan — regenerate with AI for a personalized plan.',
    meals: [
      {
        time: '7:00 AM',
        mealType: 'breakfast',
        name: 'Oats with Milk & Banana',
        nameHindi: 'दूध और केले के साथ ओट्स',
        items: ['1 cup oats', '200ml milk', '1 banana', '5 almonds'],
        calories: 380,
        protein: 15,
        carbs: 55,
        fat: 10,
        notes: 'Quick and protein-rich breakfast',
      },
      {
        time: '10:00 AM',
        mealType: 'mid_morning',
        name: 'Sprouts Chaat',
        nameHindi: 'अंकुरित चाट',
        items: ['1 bowl moong sprouts', '1 small onion', 'lemon juice', 'chaat masala'],
        calories: 150,
        protein: 10,
        carbs: 20,
        fat: 3,
      },
      {
        time: '1:00 PM',
        mealType: 'lunch',
        name: 'Dal, Rice & Sabzi',
        nameHindi: 'दाल चावल और सब्ज़ी',
        items: ['1 bowl dal', '1 bowl rice', '1 bowl mixed sabzi', '2 rotis', '1 bowl curd'],
        calories: 580,
        protein: 22,
        carbs: 80,
        fat: 15,
      },
      {
        time: '4:00 PM',
        mealType: 'evening_snack',
        name: 'Peanut Butter Toast',
        nameHindi: 'पीनट बटर टोस्ट',
        items: ['2 wheat bread slices', '2 tbsp peanut butter', '1 glass milk'],
        calories: 350,
        protein: 16,
        carbs: 35,
        fat: 18,
        notes: 'Good pre-evening workout snack',
      },
      {
        time: '8:00 PM',
        mealType: 'dinner',
        name: 'Paneer Bhurji with Roti',
        nameHindi: 'पनीर भुर्जी रोटी के साथ',
        items: ['150g paneer bhurji', '2 rotis', '1 bowl salad'],
        calories: 450,
        protein: 24,
        carbs: 40,
        fat: 20,
      },
      {
        time: '10:00 PM',
        mealType: 'bedtime',
        name: 'Warm Turmeric Milk',
        nameHindi: 'हल्दी दूध',
        items: ['1 glass warm milk', '1/2 tsp turmeric', '1 tsp honey'],
        calories: 130,
        protein: 8,
        carbs: 15,
        fat: 5,
        notes: 'Helps with recovery and sleep',
      },
    ],
  };
}
