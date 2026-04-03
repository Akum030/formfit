/**
 * FoodJournalPage — AI-powered Indian food photo analysis & macro tracking.
 *
 * Features:
 *  - Photo capture / upload for Gemini Vision analysis
 *  - Manual text-based food estimation
 *  - Meal type selector (breakfast/lunch/dinner/snack)
 *  - Per-item and total macro breakdown (cal/protein/carbs/fat/fiber)
 *  - Daily macro summary dashboard
 *  - Historical food log list
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function getUserId(): string | null {
  return localStorage.getItem('gym-userId');
}

/* ─── Types ─── */

interface FoodItem {
  name: string;
  nameHindi?: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface AnalysisResult {
  items: FoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  confidence: string;
  mealType: string;
}

interface FoodLog {
  id: string;
  mealType: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  items: string;
  loggedAt: string;
}

interface DailySummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  mealCount: number;
  logs: FoodLog[];
}

/* ─── Meal Type Config ─── */

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', labelHi: 'नाश्ता', icon: '🌅', time: '7–10 AM' },
  { id: 'lunch', label: 'Lunch', labelHi: 'दोपहर का खाना', icon: '☀️', time: '12–2 PM' },
  { id: 'snack', label: 'Snack', labelHi: 'नाश्ता', icon: '🍌', time: 'Anytime' },
  { id: 'dinner', label: 'Dinner', labelHi: 'रात का खाना', icon: '🌙', time: '7–9 PM' },
];

/* ─── Component ─── */

export function FoodJournalPage() {
  const userId = getUserId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis state
  const [selectedMeal, setSelectedMeal] = useState('lunch');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [textDescription, setTextDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Daily view
  const [daily, setDaily] = useState<DailySummary | null>(null);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');

  /* ─── Fetch daily summary & logs ─── */

  const fetchDaily = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/api/food/daily/${userId}?date=${selectedDate}`);
      if (res.ok) setDaily(await res.json());
      else setDaily(null);
    } catch { setDaily(null); }
  }, [userId, selectedDate]);

  const fetchLogs = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/api/food/logs/${userId}?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        // Backend returns flat array, not {logs: [...]}
        setLogs(Array.isArray(data) ? data : (data.logs || []));
      } else {
        setLogs([]);
      }
    } catch { setLogs([]); }
  }, [userId, selectedDate]);

  useEffect(() => {
    fetchDaily();
    fetchLogs();
  }, [fetchDaily, fetchLogs]);

  /* ─── Photo handling ─── */

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size (max 8MB)
    if (!file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Image must be under 8MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotoPreview(dataUrl);
      // Extract base64 from data URL (guard against malformed data URL)
      const parts = dataUrl.split(',');
      if (parts.length > 1) setPhotoBase64(parts[1]);
      setAnalysis(null);
      setSaveSuccess(false);
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    setPhotoPreview(null);
    setPhotoBase64(null);
    setAnalysis(null);
    setSaveSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  /* ─── Analyze ─── */

  async function handleAnalyze() {
    if (!photoBase64 && !textDescription.trim()) return;
    setAnalyzing(true);
    setAnalysis(null);
    setSaveSuccess(false);

    try {
      const payload: Record<string, string> = { mealType: selectedMeal };
      if (photoBase64) payload.photoBase64 = photoBase64;
      if (textDescription.trim()) payload.description = textDescription.trim();

      const res = await fetch(`${API_BASE}/api/food/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setAnalysis(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Analysis failed. Try again.');
      }
    } catch {
      alert('Network error. Check your connection.');
    } finally {
      setAnalyzing(false);
    }
  }

  /* ─── Save log ─── */

  async function handleSave() {
    if (!userId || !analysis) return;
    setSaving(true);

    try {
      const res = await fetch(`${API_BASE}/api/food/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          mealType: selectedMeal,
          description: textDescription || analysis.items.map((i) => i.name).join(', '),
          photoBase64: photoBase64 || undefined,
          calories: analysis.totalCalories,
          protein: analysis.totalProtein,
          carbs: analysis.totalCarbs,
          fat: analysis.totalFat,
          fiber: analysis.totalFiber,
          items: JSON.stringify(analysis.items),
          aiAnalysis: JSON.stringify(analysis),
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        // Refresh data
        fetchDaily();
        fetchLogs();
        // Reset form after a moment
        setTimeout(() => {
          clearPhoto();
          setTextDescription('');
          setAnalysis(null);
          setSaveSuccess(false);
        }, 2000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to save log. Try again.');
      }
    } catch {
      alert('Failed to save. Check your connection.');
    } finally {
      setSaving(false);
    }
  }

  /* ─── Delete log ─── */

  async function handleDelete(logId: string) {
    if (!confirm('Delete this food log?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/food/logs/${logId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDaily();
        fetchLogs();
      } else {
        alert('Failed to delete log. Try again.');
      }
    } catch {
      alert('Network error. Check your connection.');
    }
  }

  /* ─── No user fallback ─── */

  if (!userId) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="text-4xl mb-4">📸</div>
          <h2 className="text-white font-bold text-xl mb-2">Food Journal</h2>
          <p className="text-white/40 text-sm mb-6">Create a profile first to start tracking your nutrition.</p>
          <Link to="/" className="btn-glow inline-block">Go to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
          <span className="text-2xl">🍛</span>
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Food Journal</h1>
          <p className="text-white/30 text-sm">AI-powered Indian food analysis • फूड जर्नल</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6">
        {(['log', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeTab === tab
                ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/15 text-white border border-orange-500/30'
                : 'text-white/40 bg-white/[0.03] border border-white/[0.06] hover:text-white/60'
            }`}
          >
            {tab === 'log' ? '📸 Log Food' : '📊 History'}
          </button>
        ))}
      </div>

      {activeTab === 'log' ? (
        <div className="space-y-6">
          {/* ─── Meal Type Selector ─── */}
          <div className="glass-card p-5 border border-white/[0.06]">
            <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">Meal Type</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MEAL_TYPES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMeal(m.id)}
                  className={`p-3 rounded-xl text-center transition-all duration-200 ${
                    selectedMeal === m.id
                      ? 'bg-gradient-to-b from-orange-500/20 to-amber-500/10 border border-orange-500/30 shadow-lg shadow-orange-500/10'
                      : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="text-2xl block mb-1">{m.icon}</span>
                  <span className={`text-xs font-bold block ${selectedMeal === m.id ? 'text-orange-400' : 'text-white/50'}`}>
                    {m.label}
                  </span>
                  <span className="text-[10px] text-white/20">{m.time}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ─── Photo Upload ─── */}
          <div className="glass-card p-5 border border-white/[0.06]">
            <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">Food Photo</h3>

            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Food"
                  className="w-full h-64 object-cover rounded-xl border border-white/[0.1]"
                />
                <button
                  onClick={clearPhoto}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-48 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-orange-500/40 flex flex-col items-center justify-center gap-3 transition-colors group"
              >
                <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-3xl">📷</span>
                </div>
                <span className="text-white/30 text-sm font-medium">Tap to upload food photo</span>
                <span className="text-white/15 text-xs">JPG, PNG • Max 8MB</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* ─── Text Description (Optional) ─── */}
          <div className="glass-card p-5 border border-white/[0.06]">
            <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">
              Description <span className="text-white/20">(optional — helps AI accuracy)</span>
            </h3>
            <textarea
              value={textDescription}
              onChange={(e) => setTextDescription(e.target.value)}
              placeholder="e.g., 2 roti with paneer bhurji, dal, salad..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/15 focus:outline-none focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/10 transition-all resize-none text-sm"
            />
          </div>

          {/* ─── Analyze Button ─── */}
          <button
            onClick={handleAnalyze}
            disabled={analyzing || (!photoBase64 && !textDescription.trim())}
            className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-all duration-300 ${
              analyzing
                ? 'bg-orange-500/30 text-orange-300 cursor-wait'
                : !photoBase64 && !textDescription.trim()
                ? 'bg-white/[0.05] text-white/20 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_8px_32px_rgba(249,115,22,0.3)] hover:shadow-[0_12px_48px_rgba(249,115,22,0.5)] hover:-translate-y-1 active:translate-y-0'
            }`}
          >
            {analyzing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-orange-300 border-t-transparent rounded-full animate-spin" />
                Analyzing your food...
              </span>
            ) : (
              '🔍 Analyze Food'
            )}
          </button>

          {/* ─── Analysis Result ─── */}
          {analysis && (
            <div className="glass-card p-5 border border-orange-500/20 space-y-5 animate-fade-in-up">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <span className="text-orange-400">🤖</span> AI Analysis
                </h3>
                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  analysis.confidence === 'high' ? 'bg-emerald-500/15 text-emerald-400' :
                  analysis.confidence === 'medium' ? 'bg-amber-500/15 text-amber-400' :
                  'bg-red-500/15 text-red-400'
                }`}>
                  {analysis.confidence} confidence
                </span>
              </div>

              {/* Food Items */}
              <div className="space-y-2">
                {analysis.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div>
                      <span className="text-white font-medium text-sm">{item.name}</span>
                      {item.nameHindi && (
                        <span className="text-orange-400/60 text-xs ml-2">({item.nameHindi})</span>
                      )}
                      <span className="text-white/20 text-xs ml-2">{item.portion}</span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="text-amber-400 font-mono font-bold">{item.calories}cal</span>
                      <span className="text-cyan-400 font-mono">{item.protein}g P</span>
                      <span className="text-emerald-400 font-mono">{item.carbs}g C</span>
                      <span className="text-rose-400 font-mono">{item.fat}g F</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <MacroPill label="Calories" value={analysis.totalCalories} unit="kcal" color="amber" />
                <MacroPill label="Protein" value={analysis.totalProtein} unit="g" color="cyan" />
                <MacroPill label="Carbs" value={analysis.totalCarbs} unit="g" color="emerald" />
                <MacroPill label="Fat" value={analysis.totalFat} unit="g" color="rose" />
                <MacroPill label="Fiber" value={analysis.totalFiber} unit="g" color="violet" />
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={saving || saveSuccess}
                className={`w-full py-3.5 rounded-xl font-bold text-white transition-all duration-200 ${
                  saveSuccess
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : saving
                    ? 'bg-white/[0.05] text-white/30 cursor-wait'
                    : 'bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-[0_4px_20px_rgba(52,211,153,0.3)] hover:shadow-[0_4px_30px_rgba(52,211,153,0.5)] hover:-translate-y-0.5'
                }`}
              >
                {saveSuccess ? '✓ Saved to Journal!' : saving ? 'Saving...' : '💾 Save to Journal'}
              </button>
            </div>
          )}

          {/* ─── Daily Summary ─── */}
          {daily && daily.mealCount > 0 && (
            <div className="glass-card p-5 border border-white/[0.06]">
              <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                <span className="text-emerald-400">📊</span> Today's Nutrition
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <MacroCard label="Calories" value={daily.totalCalories} unit="kcal" color="amber" />
                <MacroCard label="Protein" value={daily.totalProtein} unit="g" color="cyan" />
                <MacroCard label="Carbs" value={daily.totalCarbs} unit="g" color="emerald" />
                <MacroCard label="Fat" value={daily.totalFat} unit="g" color="rose" />
                <MacroCard label="Fiber" value={daily.totalFiber} unit="g" color="violet" />
              </div>
              <div className="mt-3 text-center text-white/20 text-xs">
                {daily.mealCount} meal{daily.mealCount !== 1 ? 's' : ''} logged today
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ─── HISTORY TAB ─── */
        <div className="space-y-4">
          {/* Date Picker */}
          <div className="glass-card p-4 border border-white/[0.06] flex items-center gap-3">
            <span className="text-white/40 text-sm font-medium">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-orange-500/40"
            />
          </div>

          {/* Daily Summary for Selected Date */}
          {daily && daily.mealCount > 0 && (
            <div className="glass-card p-5 border border-white/[0.06]">
              <h3 className="text-white font-bold text-sm mb-3">Day Total</h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <MacroCard label="Cal" value={daily.totalCalories} unit="" color="amber" />
                <MacroCard label="Protein" value={daily.totalProtein} unit="g" color="cyan" />
                <MacroCard label="Carbs" value={daily.totalCarbs} unit="g" color="emerald" />
                <MacroCard label="Fat" value={daily.totalFat} unit="g" color="rose" />
                <MacroCard label="Fiber" value={daily.totalFiber} unit="g" color="violet" />
              </div>
            </div>
          )}

          {/* Log List */}
          {logs.length === 0 ? (
            <div className="glass-card p-10 text-center border border-white/[0.06]">
              <span className="text-4xl block mb-3">🍽️</span>
              <p className="text-white/30 text-sm">No meals logged for this date</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                let items: FoodItem[] = [];
                try { items = JSON.parse(log.items || '[]'); } catch { /* ignore */ }

                return (
                  <div key={log.id} className="glass-card p-4 border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {MEAL_TYPES.find((m) => m.id === log.mealType)?.icon || '🍽️'}
                        </span>
                        <span className="text-white font-bold text-sm capitalize">{log.mealType}</span>
                        <span className="text-white/20 text-xs">
                          {new Date(log.loggedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="text-white/20 hover:text-red-400 text-xs transition-colors"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Items */}
                    {items.length > 0 && (
                      <div className="text-white/40 text-xs mb-2">
                        {items.map((item) => item.name).join(' • ')}
                      </div>
                    )}

                    {/* Macros row */}
                    <div className="flex gap-3 text-xs">
                      <span className="text-amber-400 font-mono font-bold">{log.calories} cal</span>
                      <span className="text-cyan-400 font-mono">{log.protein}g P</span>
                      <span className="text-emerald-400 font-mono">{log.carbs}g C</span>
                      <span className="text-rose-400 font-mono">{log.fat}g F</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Reusable sub-components ─── */

function MacroPill({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const styles: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  };

  return (
    <div className={`p-2 rounded-xl border text-center ${styles[color] || styles.amber}`}>
      <div className="text-lg font-black font-mono leading-none">{Math.round(value)}</div>
      <div className="text-[10px] opacity-60 mt-0.5">{unit} {label}</div>
    </div>
  );
}

function MacroCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    amber: { bg: 'from-amber-500/15 to-amber-500/5 border-amber-500/20', text: 'text-amber-400' },
    cyan: { bg: 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/20', text: 'text-cyan-400' },
    emerald: { bg: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20', text: 'text-emerald-400' },
    rose: { bg: 'from-rose-500/15 to-rose-500/5 border-rose-500/20', text: 'text-rose-400' },
    violet: { bg: 'from-violet-500/15 to-violet-500/5 border-violet-500/20', text: 'text-violet-400' },
  };
  const s = styles[color] || styles.amber;

  return (
    <div className={`glass-card p-3 bg-gradient-to-b ${s.bg} border text-center`}>
      <div className={`text-xl font-black font-mono ${s.text} leading-none`}>{Math.round(value)}</div>
      <div className="text-[10px] text-white/30 mt-1">{unit} {label}</div>
    </div>
  );
}
