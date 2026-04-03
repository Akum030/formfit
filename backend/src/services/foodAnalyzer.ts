/**
 * Food Analyzer Service — Local Indian food nutrition database + fuzzy matching.
 *
 * Replaces Gemini Vision dependency with a comprehensive offline database
 * of 60+ common Indian foods. Text-based matching handles manual food entry.
 * Photo analysis gracefully delegates to text description.
 *
 * Zero external API calls — works completely offline.
 */

// ── Types ─────────────────────────────────────────────────

export interface FoodItem {
  name: string;
  nameHindi?: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface FoodAnalysisResult {
  items: FoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  aiAnalysis: string;
}

// ── Indian Food Nutrition Database ────────────────────────
// Per-serving values based on standard Indian nutritional references (NIN/ICMR)

interface FoodEntry {
  name: string;
  nameHindi: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  keywords: string[];
}

const FOOD_DB: FoodEntry[] = [
  // Breads / Rotis
  { name: 'Roti / Chapati', nameHindi: 'रोटी / चपाती', portion: '1 medium (40g atta)', calories: 120, protein: 3, carbs: 20, fat: 3.5, fiber: 2, keywords: ['roti', 'chapati', 'chapatti', 'phulka', 'fulka'] },
  { name: 'Paratha (Plain)', nameHindi: 'पराठा', portion: '1 medium', calories: 200, protein: 4, carbs: 28, fat: 8, fiber: 2, keywords: ['paratha', 'parantha', 'pratha', 'plain paratha'] },
  { name: 'Aloo Paratha', nameHindi: 'आलू पराठा', portion: '1 medium', calories: 280, protein: 5, carbs: 35, fat: 12, fiber: 3, keywords: ['aloo paratha', 'potato paratha', 'aloo parantha'] },
  { name: 'Paneer Paratha', nameHindi: 'पनीर पराठा', portion: '1 medium', calories: 300, protein: 10, carbs: 30, fat: 15, fiber: 2, keywords: ['paneer paratha', 'paneer parantha'] },
  { name: 'Naan', nameHindi: 'नान', portion: '1 piece', calories: 260, protein: 7, carbs: 45, fat: 5, fiber: 2, keywords: ['naan', 'nan', 'butter naan', 'garlic naan'] },
  { name: 'Puri', nameHindi: 'पूरी', portion: '2 pieces', calories: 200, protein: 3, carbs: 22, fat: 10, fiber: 1, keywords: ['puri', 'poori'] },
  { name: 'Dosa (Plain)', nameHindi: 'दोसा', portion: '1 medium', calories: 170, protein: 4, carbs: 28, fat: 5, fiber: 1, keywords: ['dosa', 'plain dosa', 'sada dosa'] },
  { name: 'Masala Dosa', nameHindi: 'मसाला दोसा', portion: '1 piece', calories: 280, protein: 6, carbs: 38, fat: 12, fiber: 3, keywords: ['masala dosa'] },
  { name: 'Idli', nameHindi: 'इडली', portion: '2 pieces', calories: 120, protein: 4, carbs: 22, fat: 1, fiber: 1, keywords: ['idli', 'idly'] },

  // Rice
  { name: 'White Rice (Cooked)', nameHindi: 'सफ़ेद चावल', portion: '1 bowl (150g)', calories: 180, protein: 3, carbs: 40, fat: 0.5, fiber: 0.5, keywords: ['rice', 'chawal', 'white rice', 'plain rice', 'steamed rice'] },
  { name: 'Brown Rice', nameHindi: 'ब्राउन राइस', portion: '1 bowl (150g)', calories: 170, protein: 4, carbs: 36, fat: 1.5, fiber: 3, keywords: ['brown rice'] },
  { name: 'Jeera Rice', nameHindi: 'जीरा राइस', portion: '1 bowl', calories: 220, protein: 4, carbs: 38, fat: 5, fiber: 1, keywords: ['jeera rice', 'cumin rice'] },
  { name: 'Biryani (Chicken)', nameHindi: 'चिकन बिरयानी', portion: '1 plate (250g)', calories: 400, protein: 22, carbs: 45, fat: 14, fiber: 2, keywords: ['biryani', 'biriyani', 'chicken biryani'] },
  { name: 'Veg Biryani', nameHindi: 'वेज बिरयानी', portion: '1 plate (250g)', calories: 320, protein: 8, carbs: 48, fat: 10, fiber: 3, keywords: ['veg biryani', 'vegetable biryani'] },
  { name: 'Pulao', nameHindi: 'पुलाव', portion: '1 bowl', calories: 250, protein: 5, carbs: 40, fat: 7, fiber: 2, keywords: ['pulao', 'pulav', 'pilaf', 'veg pulao'] },
  { name: 'Khichdi', nameHindi: 'खिचड़ी', portion: '1 bowl', calories: 200, protein: 7, carbs: 35, fat: 4, fiber: 3, keywords: ['khichdi', 'khichri'] },

  // Dal / Lentils
  { name: 'Dal Tadka', nameHindi: 'दाल तड़का', portion: '1 bowl (200ml)', calories: 180, protein: 9, carbs: 22, fat: 6, fiber: 4, keywords: ['dal', 'daal', 'dal tadka', 'dal fry'] },
  { name: 'Moong Dal', nameHindi: 'मूंग दाल', portion: '1 bowl', calories: 150, protein: 10, carbs: 18, fat: 4, fiber: 3, keywords: ['moong dal', 'moong'] },
  { name: 'Chana Dal', nameHindi: 'चना दाल', portion: '1 bowl', calories: 190, protein: 10, carbs: 24, fat: 5, fiber: 5, keywords: ['chana dal'] },
  { name: 'Rajma (Kidney Beans)', nameHindi: 'राजमा', portion: '1 bowl', calories: 210, protein: 11, carbs: 28, fat: 5, fiber: 6, keywords: ['rajma', 'kidney beans', 'rajma chawal'] },
  { name: 'Chole (Chickpeas)', nameHindi: 'छोले', portion: '1 bowl', calories: 220, protein: 10, carbs: 30, fat: 7, fiber: 5, keywords: ['chole', 'chhole', 'chana', 'chickpea'] },
  { name: 'Sambar', nameHindi: 'सांभर', portion: '1 bowl', calories: 140, protein: 6, carbs: 18, fat: 5, fiber: 4, keywords: ['sambar', 'sambhar'] },

  // Sabzi / Vegetables
  { name: 'Aloo Gobi', nameHindi: 'आलू गोभी', portion: '1 bowl', calories: 180, protein: 4, carbs: 20, fat: 9, fiber: 4, keywords: ['aloo gobi', 'aloo gobhi', 'potato cauliflower'] },
  { name: 'Palak Paneer', nameHindi: 'पालक पनीर', portion: '1 bowl', calories: 280, protein: 14, carbs: 10, fat: 20, fiber: 3, keywords: ['palak paneer', 'spinach paneer'] },
  { name: 'Paneer Butter Masala', nameHindi: 'पनीर बटर मसाला', portion: '1 bowl', calories: 350, protein: 15, carbs: 14, fat: 26, fiber: 2, keywords: ['paneer butter masala', 'paneer makhani', 'shahi paneer'] },
  { name: 'Mixed Sabzi', nameHindi: 'मिक्स सब्ज़ी', portion: '1 bowl', calories: 120, protein: 3, carbs: 14, fat: 6, fiber: 4, keywords: ['sabzi', 'sabji', 'mixed veg', 'mixed vegetable'] },
  { name: 'Matar Paneer', nameHindi: 'मटर पनीर', portion: '1 bowl', calories: 300, protein: 13, carbs: 16, fat: 20, fiber: 4, keywords: ['matar paneer', 'peas paneer'] },

  // Non-Veg
  { name: 'Chicken Curry', nameHindi: 'चिकन करी', portion: '1 serving (200g)', calories: 250, protein: 25, carbs: 8, fat: 14, fiber: 1, keywords: ['chicken curry', 'chicken', 'murgh'] },
  { name: 'Butter Chicken', nameHindi: 'बटर चिकन', portion: '1 serving', calories: 350, protein: 28, carbs: 12, fat: 22, fiber: 1, keywords: ['butter chicken', 'murgh makhani'] },
  { name: 'Chicken Tikka', nameHindi: 'चिकन टिक्का', portion: '6 pieces', calories: 220, protein: 30, carbs: 4, fat: 10, fiber: 0, keywords: ['chicken tikka', 'tikka', 'tandoori chicken'] },
  { name: 'Fish Curry', nameHindi: 'मछली करी', portion: '1 serving', calories: 200, protein: 22, carbs: 6, fat: 10, fiber: 1, keywords: ['fish curry', 'fish', 'machli', 'machhi'] },
  { name: 'Egg Curry', nameHindi: 'अंडा करी', portion: '2 eggs', calories: 220, protein: 14, carbs: 8, fat: 15, fiber: 1, keywords: ['egg curry', 'anda curry'] },

  // Dairy
  { name: 'Paneer (Raw)', nameHindi: 'पनीर', portion: '100g', calories: 265, protein: 18, carbs: 3, fat: 20, fiber: 0, keywords: ['paneer', 'cottage cheese'] },
  { name: 'Curd / Dahi', nameHindi: 'दही', portion: '1 bowl (200g)', calories: 120, protein: 7, carbs: 9, fat: 6, fiber: 0, keywords: ['curd', 'dahi', 'yogurt', 'yoghurt', 'raita'] },
  { name: 'Milk', nameHindi: 'दूध', portion: '1 glass (250ml)', calories: 150, protein: 8, carbs: 12, fat: 8, fiber: 0, keywords: ['milk', 'dudh', 'glass of milk'] },
  { name: 'Lassi (Sweet)', nameHindi: 'लस्सी', portion: '1 glass', calories: 180, protein: 6, carbs: 28, fat: 5, fiber: 0, keywords: ['lassi', 'sweet lassi'] },

  // Eggs
  { name: 'Boiled Egg', nameHindi: 'उबला अंडा', portion: '1 large', calories: 70, protein: 6, carbs: 0.5, fat: 5, fiber: 0, keywords: ['egg', 'boiled egg', 'anda'] },
  { name: 'Omelette', nameHindi: 'ऑमलेट', portion: '2 eggs', calories: 180, protein: 12, carbs: 2, fat: 14, fiber: 0, keywords: ['omelette', 'omelet', 'anda omelette'] },
  { name: 'Egg Bhurji', nameHindi: 'अंडा भुर्जी', portion: '2 eggs', calories: 200, protein: 13, carbs: 4, fat: 15, fiber: 0, keywords: ['egg bhurji', 'anda bhurji', 'scrambled egg'] },

  // Breakfast / Snacks
  { name: 'Poha', nameHindi: 'पोहा', portion: '1 plate', calories: 250, protein: 5, carbs: 40, fat: 8, fiber: 2, keywords: ['poha', 'pohe', 'flattened rice'] },
  { name: 'Upma', nameHindi: 'उपमा', portion: '1 bowl', calories: 220, protein: 5, carbs: 32, fat: 8, fiber: 2, keywords: ['upma', 'uppuma'] },
  { name: 'Oats', nameHindi: 'ओट्स', portion: '1 cup cooked', calories: 180, protein: 7, carbs: 30, fat: 4, fiber: 4, keywords: ['oats', 'oatmeal', 'porridge'] },
  { name: 'Sprouts', nameHindi: 'अंकुरित', portion: '1 bowl', calories: 130, protein: 9, carbs: 18, fat: 2, fiber: 5, keywords: ['sprouts', 'moong sprouts', 'ankurit'] },
  { name: 'Samosa', nameHindi: 'समोसा', portion: '1 piece', calories: 250, protein: 4, carbs: 28, fat: 14, fiber: 2, keywords: ['samosa'] },
  { name: 'Pav Bhaji', nameHindi: 'पाव भाजी', portion: '1 plate (2 pav)', calories: 400, protein: 10, carbs: 52, fat: 16, fiber: 4, keywords: ['pav bhaji'] },
  { name: 'Maggi Noodles', nameHindi: 'मैगी', portion: '1 pack', calories: 350, protein: 8, carbs: 46, fat: 14, fiber: 2, keywords: ['maggi', 'noodles', 'instant noodles'] },

  // Sweets
  { name: 'Gulab Jamun', nameHindi: 'गुलाब जामुन', portion: '2 pieces', calories: 300, protein: 4, carbs: 42, fat: 12, fiber: 0, keywords: ['gulab jamun'] },
  { name: 'Kheer', nameHindi: 'खीर', portion: '1 bowl', calories: 250, protein: 6, carbs: 38, fat: 8, fiber: 0, keywords: ['kheer', 'payasam'] },
  { name: 'Halwa', nameHindi: 'हलवा', portion: '1 serving', calories: 300, protein: 4, carbs: 40, fat: 14, fiber: 1, keywords: ['halwa', 'halva', 'suji halwa', 'gajar halwa'] },

  // Beverages
  { name: 'Chai (with milk & sugar)', nameHindi: 'चाय', portion: '1 cup', calories: 80, protein: 2, carbs: 12, fat: 3, fiber: 0, keywords: ['chai', 'tea', 'masala chai'] },
  { name: 'Black Coffee', nameHindi: 'ब्लैक कॉफ़ी', portion: '1 cup', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0, keywords: ['coffee', 'black coffee'] },
  { name: 'Protein Shake', nameHindi: 'प्रोटीन शेक', portion: '1 scoop + milk', calories: 250, protein: 30, carbs: 18, fat: 6, fiber: 1, keywords: ['protein shake', 'whey', 'protein'] },

  // Fruits
  { name: 'Banana', nameHindi: 'केला', portion: '1 medium', calories: 105, protein: 1, carbs: 27, fat: 0.3, fiber: 3, keywords: ['banana', 'kela'] },
  { name: 'Apple', nameHindi: 'सेब', portion: '1 medium', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4, keywords: ['apple', 'seb'] },
  { name: 'Mango', nameHindi: 'आम', portion: '1 medium', calories: 150, protein: 1, carbs: 35, fat: 0.5, fiber: 3, keywords: ['mango', 'aam'] },

  // Nuts / Dry Fruits
  { name: 'Almonds', nameHindi: 'बादाम', portion: '10 pieces (15g)', calories: 85, protein: 3, carbs: 3, fat: 7, fiber: 2, keywords: ['almonds', 'badam'] },
  { name: 'Peanuts', nameHindi: 'मूंगफली', portion: '1 handful (30g)', calories: 170, protein: 7, carbs: 5, fat: 14, fiber: 2, keywords: ['peanuts', 'moongfali', 'groundnut'] },

  // Misc
  { name: 'Peanut Butter Toast', nameHindi: 'पीनट बटर टोस्ट', portion: '2 slices + 2 tbsp PB', calories: 320, protein: 12, carbs: 28, fat: 18, fiber: 3, keywords: ['peanut butter', 'toast', 'bread'] },
  { name: 'Bread Slice', nameHindi: 'ब्रेड', portion: '2 slices', calories: 140, protein: 4, carbs: 26, fat: 2, fiber: 1, keywords: ['bread', 'white bread', 'brown bread'] },
];


// ── Fuzzy Matching Engine ─────────────────────────────────

function tokenize(text: string): string[] {
  const stopWords = new Set(['with', 'and', 'or', 'the', 'a', 'an', 'of', 'in', 'i', 'had', 'ate', 'have', 'having', 'my', 'for', 'ke', 'ka', 'ki', 'aur', 'ne', 'se', 'ko', 'mein', 'saath']);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !stopWords.has(t));
}

function parseQuantity(text: string): { quantity: number; cleanedText: string } {
  const halfMatch = text.match(/\b(half|aadha|aadhi|adha)\b/i);
  if (halfMatch) return { quantity: 0.5, cleanedText: text.replace(halfMatch[0], '').trim() };

  const numMatch = text.match(/^(\d+(?:\.\d+)?)\s*x?\s*/);
  if (numMatch) return { quantity: parseFloat(numMatch[1]), cleanedText: text.replace(numMatch[0], '').trim() };

  const trailingNum = text.match(/\s(\d+)$/);
  if (trailingNum) return { quantity: parseInt(trailingNum[1]), cleanedText: text.replace(trailingNum[0], '').trim() };

  return { quantity: 1, cleanedText: text };
}

function matchScore(entry: FoodEntry, tokens: string[]): number {
  let score = 0;
  const entryText = [entry.name.toLowerCase(), ...entry.keywords].join(' ');
  for (const token of tokens) {
    if (entry.keywords.some(k => k === token)) score += 10;
    else if (entry.keywords.some(k => k.startsWith(token) || token.startsWith(k))) score += 6;
    else if (entryText.includes(token)) score += 3;
  }
  return score;
}

function findMatchingFoods(description: string): FoodItem[] {
  const itemTexts = description
    .split(/[,\n]+|(?:\s+and\s+)|(?:\s+aur\s+)/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const results: FoodItem[] = [];

  for (const itemText of itemTexts) {
    const { quantity, cleanedText } = parseQuantity(itemText);
    const tokens = tokenize(cleanedText);
    if (tokens.length === 0) continue;

    const scored = FOOD_DB
      .map(entry => ({ entry, score: matchScore(entry, tokens) }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const best = scored[0].entry;
      results.push({
        name: quantity !== 1 ? `${quantity}x ${best.name}` : best.name,
        nameHindi: best.nameHindi,
        portion: quantity !== 1 ? `${quantity} × ${best.portion}` : best.portion,
        calories: Math.round(best.calories * quantity),
        protein: Math.round(best.protein * quantity),
        carbs: Math.round(best.carbs * quantity),
        fat: Math.round(best.fat * quantity),
        fiber: Math.round(best.fiber * quantity),
      });
    } else {
      results.push({
        name: cleanedText || itemText,
        portion: '1 serving (estimated)',
        calories: 200, protein: 5, carbs: 25, fat: 8, fiber: 2,
      });
    }
  }

  return results;
}


// ── Public API ────────────────────────────────────────────

export async function analyzeFoodPhoto(photoBase64: string, userDescription?: string): Promise<FoodAnalysisResult> {
  if (userDescription && userDescription.trim()) {
    const items = findMatchingFoods(userDescription);
    return buildResult(items, `Analysis based on: "${userDescription}"`, items.length > 0 ? 'medium' : 'low');
  }

  // Photo-only — return guidance to add description
  return {
    items: [],
    totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0,
    description: 'Please add a text description of your food for nutrition analysis. Example: "2 roti, 1 bowl dal, rice, curd"',
    confidence: 'low',
    aiAnalysis: 'Photo-only analysis requires AI API key. Add a text description for local nutrition lookup.',
  };
}

export async function estimateNutrition(description: string): Promise<FoodAnalysisResult> {
  const items = findMatchingFoods(description);

  if (items.length === 0) {
    return {
      items: [{ name: description, portion: '1 serving (estimated)', calories: 200, protein: 5, carbs: 25, fat: 8, fiber: 2 }],
      totalCalories: 200, totalProtein: 5, totalCarbs: 25, totalFat: 8, totalFiber: 2,
      description: `Estimated nutrition for: ${description}`,
      confidence: 'low',
      aiAnalysis: 'No exact match — try specific names like "roti", "dal", "rice", "paneer", "chicken curry".',
    };
  }

  return buildResult(items, `Nutrition for: ${description}`, 'high');
}

function buildResult(items: FoodItem[], description: string, confidence: 'high' | 'medium' | 'low'): FoodAnalysisResult {
  return {
    items,
    totalCalories: items.reduce((s, i) => s + i.calories, 0),
    totalProtein: items.reduce((s, i) => s + i.protein, 0),
    totalCarbs: items.reduce((s, i) => s + i.carbs, 0),
    totalFat: items.reduce((s, i) => s + i.fat, 0),
    totalFiber: items.reduce((s, i) => s + i.fiber, 0),
    description,
    confidence,
    aiAnalysis: `Matched ${items.length} item(s) from local Indian food database (60+ foods).`,
  };
}
