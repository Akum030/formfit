/**
 * HomePage — Stunning landing page with hero, stats, calendar, features, and quick-start.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarHeatmap } from '../components/CalendarHeatmap';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function getUserId(): string | null {
  return localStorage.getItem('gym-userId');
}

function saveUserId(id: string) {
  localStorage.setItem('gym-userId', id);
}

interface UserStats {
  totalSessions: number;
  totalReps: number;
  avgScore: number;
  streak: number;
}

interface CalendarDay {
  date: string;
  sessions: number;
  totalReps: number;
  avgScore: number;
}

const FEATURES = [
  {
    icon: '🎯',
    title: 'MoveNet Pose Detection',
    desc: 'Real-time 17-point skeleton tracking at 15+ FPS powered by TensorFlow.js — works entirely in your browser.',
    gradient: 'from-cyan-500 to-blue-500',
    border: 'border-cyan-500/20',
    bg: 'from-cyan-500/10 to-blue-500/5',
  },
  {
    icon: '🧠',
    title: 'Gemini AI Analysis',
    desc: 'Intelligent form scoring and real-time coaching powered by Google Gemini 2.5 Flash with multi-model fallback.',
    gradient: 'from-violet-500 to-fuchsia-500',
    border: 'border-violet-500/20',
    bg: 'from-violet-500/10 to-fuchsia-500/5',
  },
  {
    icon: '🎙️',
    title: 'Voice Coach',
    desc: 'Always-listening duplex voice agent with Sarvam AI — interrupt naturally and get spoken coaching feedback.',
    gradient: 'from-emerald-500 to-teal-500',
    border: 'border-emerald-500/20',
    bg: 'from-emerald-500/10 to-teal-500/5',
  },
  {
    icon: '📊',
    title: 'Smart Scoring',
    desc: 'Blended angle-based + AI scoring with per-rep tracking, phase detection, and visual feedback overlay.',
    gradient: 'from-amber-500 to-orange-500',
    border: 'border-amber-500/20',
    bg: 'from-amber-500/10 to-orange-500/5',
  },
];

const EXERCISE_CARDS = [
  // Bodyweight / Home
  { id: 'squat', name: 'Squat', icon: '🦵', gradient: 'from-blue-500 to-cyan-500', shadow: 'shadow-blue-500/20' },
  { id: 'pushup', name: 'Push-up', icon: '💪', gradient: 'from-red-500 to-orange-500', shadow: 'shadow-red-500/20' },
  { id: 'lunge', name: 'Lunge', icon: '🏃', gradient: 'from-green-500 to-emerald-500', shadow: 'shadow-green-500/20' },
  { id: 'jumping_jacks', name: 'Jumping Jacks', icon: '⭐', gradient: 'from-yellow-500 to-amber-500', shadow: 'shadow-yellow-500/20' },
  { id: 'high_knees', name: 'High Knees', icon: '🔥', gradient: 'from-orange-500 to-red-500', shadow: 'shadow-orange-500/20' },
  { id: 'glute_bridge', name: 'Glute Bridge', icon: '🍑', gradient: 'from-pink-500 to-rose-500', shadow: 'shadow-pink-500/20' },
  { id: 'calf_raise', name: 'Calf Raise', icon: '🦶', gradient: 'from-teal-500 to-cyan-500', shadow: 'shadow-teal-500/20' },
  { id: 'tricep_dip', name: 'Tricep Dip', icon: '🪑', gradient: 'from-indigo-500 to-blue-500', shadow: 'shadow-indigo-500/20' },
  { id: 'wall_sit', name: 'Wall Sit', icon: '🧱', gradient: 'from-stone-500 to-gray-500', shadow: 'shadow-stone-500/20' },
  { id: 'sumo_squat', name: 'Sumo Squat', icon: '🏯', gradient: 'from-purple-500 to-violet-500', shadow: 'shadow-purple-500/20' },
  { id: 'standing_crunch', name: 'Standing Crunch', icon: '🎯', gradient: 'from-lime-500 to-green-500', shadow: 'shadow-lime-500/20' },
  { id: 'leg_raise', name: 'Leg Raise', icon: '🦿', gradient: 'from-sky-500 to-blue-500', shadow: 'shadow-sky-500/20' },
  // Dumbbell / Gym
  { id: 'bicep_curl', name: 'Bicep Curl', icon: '🦾', gradient: 'from-violet-500 to-purple-500', shadow: 'shadow-violet-500/20' },
  { id: 'shoulder_press', name: 'Shoulder Press', icon: '🏋️', gradient: 'from-amber-500 to-yellow-500', shadow: 'shadow-amber-500/20' },
  { id: 'lateral_raise', name: 'Lateral Raise', icon: '🪽', gradient: 'from-fuchsia-500 to-pink-500', shadow: 'shadow-fuchsia-500/20' },
  { id: 'front_raise', name: 'Front Raise', icon: '🫴', gradient: 'from-rose-500 to-red-500', shadow: 'shadow-rose-500/20' },
  { id: 'dumbbell_row', name: 'Dumbbell Row', icon: '🚣', gradient: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-500/20' },
  { id: 'hammer_curl', name: 'Hammer Curl', icon: '🔨', gradient: 'from-slate-500 to-zinc-500', shadow: 'shadow-slate-500/20' },
  { id: 'deadlift', name: 'Deadlift', icon: '🏗️', gradient: 'from-red-600 to-orange-500', shadow: 'shadow-red-600/20' },
  { id: 'goblet_squat', name: 'Goblet Squat', icon: '🏆', gradient: 'from-cyan-500 to-blue-500', shadow: 'shadow-cyan-500/20' },
  { id: 'overhead_tricep', name: 'Overhead Tricep', icon: '🙆', gradient: 'from-violet-600 to-indigo-500', shadow: 'shadow-violet-600/20' },
];

export function HomePage() {
  const [userId, setUserId] = useState<string | null>(getUserId());
  const [userName, setUserName] = useState('');
  const [stats, setStats] = useState<UserStats>({ totalSessions: 0, totalReps: 0, avgScore: 0, streak: 0 });
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(!getUserId());

  useEffect(() => {
    if (userId) {
      fetchUser(userId);
      fetchStats(userId);
      fetchCalendar(userId);
    }
  }, [userId]);

  async function fetchUser(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}`);
      if (res.ok) {
        const data = await res.json();
        setUserName(data.name || 'Athlete');
      }
    } catch { /* offline */ }
  }

  async function fetchStats(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}/stats`);
      if (res.ok) setStats(await res.json());
    } catch { /* offline */ }
  }

  async function fetchCalendar(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}/calendar`);
      if (res.ok) {
        const data = await res.json();
        setCalendar(data.days || []);
      }
    } catch { /* offline */ }
  }

  async function handleCreateUser(name: string) {
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        saveUserId(data.id);
        setUserId(data.id);
        setUserName(name);
        setShowOnboarding(false);
      }
    } catch {
      const localId = `local-${Date.now()}`;
      saveUserId(localId);
      setUserId(localId);
      setUserName(name);
      setShowOnboarding(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Onboarding */}
      {showOnboarding && <OnboardingModal onComplete={handleCreateUser} />}

      {/* ═══════ HERO ═══════ */}
      <section className="relative overflow-hidden">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="absolute inset-0 hero-grid" />

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-28 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8 animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-sm font-semibold tracking-wide">
              MoveNet + Gemini AI + Sarvam Voice
            </span>
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white mb-6 leading-[1.08] animate-fade-in-up anim-delay-100">
            Your Personal
            <br />
            <span className="hero-gradient-text">FitSenseAI</span>
          </h1>

          {/* Subtitle */}
          <p className="text-white/45 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up anim-delay-200">
            Real-time pose detection, intelligent form analysis, and voice coaching
            — all running in your browser. No equipment needed.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-4 animate-fade-in-up anim-delay-300">
            <Link
              to="/workout"
              className="group relative px-8 py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-[0_8px_32px_rgba(52,211,153,0.3)] hover:shadow-[0_12px_48px_rgba(52,211,153,0.5)] hover:-translate-y-1 active:translate-y-0 transition-all duration-300"
            >
              🚀 Start Training
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl -z-10" />
            </Link>
            <Link
              to="/history"
              className="px-8 py-4 rounded-2xl font-bold text-white/70 bg-white/[0.04] border border-white/[0.1] hover:bg-white/[0.08] hover:text-white transition-all duration-300"
            >
              📊 View History
            </Link>
          </div>

          {/* Welcome back */}
          {userId && userName && (
            <div className="mt-8 animate-fade-in-up anim-delay-400">
              <span className="text-white/30 text-sm">Welcome back, </span>
              <span className="text-emerald-400 font-bold">{userName}</span>
              <span className="text-white/30 text-sm"> 👋</span>
            </div>
          )}
        </div>
      </section>

      {/* ═══════ STATS ═══════ */}
      <section className="max-w-6xl mx-auto px-6 -mt-14 relative z-10 mb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard value={stats.totalSessions} label="Workouts" icon="🏋️" color="emerald" />
          <StatCard value={stats.totalReps} label="Total Reps" icon="🔄" color="cyan" />
          <StatCard value={stats.avgScore > 0 ? `${stats.avgScore}%` : '—'} label="Avg Score" icon="⭐" color="amber" />
          <StatCard value={stats.streak} label="Day Streak" icon="🔥" color="red" />
        </div>
      </section>

      {/* ═══════ CALENDAR ═══════ */}
      {userId && (
        <section className="max-w-6xl mx-auto px-6 mb-16 animate-fade-in-up">
          <SectionHeader icon="📅" title="Workout Calendar" subtitle="Your training consistency this month" />
          <CalendarHeatmap data={calendar} />
        </section>
      )}

      {/* ═══════ FEATURES ═══════ */}
      <section className="max-w-6xl mx-auto px-6 mb-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Powered by AI</h2>
          <p className="text-white/35 max-w-xl mx-auto">
            Three cutting-edge AI systems working together to be your perfect gym coach
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`glass-card p-6 border ${f.border} group hover:-translate-y-2 hover:shadow-2xl transition-all duration-300`}
            >
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.bg} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300`}
              >
                {f.icon}
              </div>
              <h3 className="text-white font-bold mb-2 text-sm">{f.title}</h3>
              <p className="text-white/35 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ QUICK START ═══════ */}
      <section className="max-w-6xl mx-auto px-6 mb-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Quick Start</h2>
          <p className="text-white/35">Choose an exercise and jump into AI-powered coaching</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
          {EXERCISE_CARDS.map((ex) => (
            <Link
              key={ex.id}
              to={`/workout?exercise=${ex.id}`}
              className={`glass-card p-6 text-center group hover:-translate-y-2 hover:shadow-2xl ${ex.shadow} transition-all duration-300 border border-white/[0.06] hover:border-white/[0.15]`}
            >
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${ex.gradient} flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}
              >
                {ex.icon}
              </div>
              <div className="text-white font-bold text-sm">{ex.name}</div>
              <div className="text-white/20 text-xs mt-1">Start now →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════ TECH STACK BANNER ═══════ */}
      <section className="max-w-6xl mx-auto px-6 mb-16">
        <div className="glass-card p-8 border border-white/[0.06] text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-violet-500/5 to-cyan-500/5" />
          <div className="relative">
            <h3 className="text-white/50 text-xs font-bold uppercase tracking-[0.2em] mb-4">Built With</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                'TensorFlow.js', 'MoveNet Thunder', 'Google Gemini 2.5',
                'Sarvam AI', 'React 18', 'WebSockets', 'Prisma', 'Express',
              ].map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/40 text-xs font-medium hover:bg-white/[0.08] hover:text-white/60 transition-all cursor-default"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-white/[0.04] py-8">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-white/15 text-sm">FitSenseAI · Hackathon 2026 · Built with ❤️ and AI</p>
        </div>
      </footer>
    </div>
  );
}

/* ─────── Sub-components ─────── */

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center shadow-inner">
        <span className="text-xl">{icon}</span>
      </div>
      <div>
        <h2 className="text-white font-bold text-xl">{title}</h2>
        <p className="text-white/30 text-sm">{subtitle}</p>
      </div>
    </div>
  );
}

function StatCard({ value, label, icon, color }: { value: number | string; label: string; icon: string; color: string }) {
  const styles: Record<string, { card: string; text: string }> = {
    emerald: { card: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20', text: 'text-emerald-400' },
    cyan:    { card: 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/20',       text: 'text-cyan-400' },
    amber:   { card: 'from-amber-500/15 to-amber-500/5 border-amber-500/20',     text: 'text-amber-400' },
    red:     { card: 'from-red-500/15 to-red-500/5 border-red-500/20',           text: 'text-red-400' },
  };
  const s = styles[color] || styles.emerald;

  return (
    <div className={`glass-card p-5 bg-gradient-to-b ${s.card} border group hover:-translate-y-1 hover:shadow-lg transition-all duration-300`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-white/30 text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-3xl font-black font-mono ${s.text} leading-none`}>{value}</div>
    </div>
  );
}

function OnboardingModal({ onComplete }: { onComplete: (name: string) => void }) {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="glass-card p-8 max-w-md w-full mx-4 border border-white/[0.1] animate-fade-in-up shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-emerald-500/30">
            🏋️
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Welcome to FitSenseAI</h2>
          <p className="text-white/35 text-sm">Set up your profile to track progress and personalize coaching</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-white/50 text-xs font-semibold mb-1.5 block uppercase tracking-wider">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && onComplete(name.trim())}
              placeholder="Enter your name..."
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/15 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 transition-all"
              autoFocus
            />
          </div>

          <button
            onClick={() => onComplete(name.trim() || 'Athlete')}
            className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-[0_4px_20px_rgba(52,211,153,0.3)] hover:shadow-[0_4px_30px_rgba(52,211,153,0.5)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-30 transition-all duration-200"
          >
            Let's Go! 🚀
          </button>

          <button
            onClick={() => onComplete('Athlete')}
            className="w-full py-2 text-white/20 text-sm hover:text-white/40 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
