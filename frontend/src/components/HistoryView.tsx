/**
 * HistoryView — Displays past workout sessions with drill-down details.
 * Enhanced with user filtering, date range, and improved exercise journal styling.
 */

import { useEffect, useState, useCallback } from 'react';
import type { Session } from '../types';
import { scoreToColor } from '../utils/pose';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function getUserId(): string | null {
  return localStorage.getItem('gym-userId');
}

interface HistoryViewProps {
  onBack: () => void;
}

export function HistoryView({ onBack }: HistoryViewProps) {
  const userId = getUserId();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Extracted so it can be called from both useEffect and retry button
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(false);
      const url = userId
        ? `${API_BASE}/api/sessions?limit=30&userId=${userId}`
        : `${API_BASE}/api/sessions?limit=30`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      } else {
        setFetchError(true);
      }
    } catch (err) {
      console.error('[History] fetch error:', err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  async function loadSessionDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSession(data);
      } else {
        alert('Failed to load session details.');
      }
    } catch (err) {
      console.error('[History] detail error:', err);
      alert('Network error. Check your connection.');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={selectedSession ? () => setSelectedSession(null) : onBack}
          className="p-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-white">
          {selectedSession ? 'Session Detail' : 'Workout History'}
        </h2>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-gym-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white/50 mt-3">Loading sessions...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !fetchError && sessions.length === 0 && !selectedSession && (
        <div className="text-center py-12">
          <div className="text-3xl font-black text-white/20 mb-4">FIT</div>
          <p className="text-white/50 text-lg">No workouts yet</p>
          <p className="text-white/30 text-sm mt-1">Complete a workout to see it here</p>
        </div>
      )}

      {/* Fetch error state */}
      {!loading && fetchError && (
        <div className="text-center py-12">
          <p className="text-red-400 text-lg font-medium">Failed to load sessions</p>
          <p className="text-white/40 text-sm mt-1">Check your connection and try again</p>
          <button
            onClick={fetchSessions}
            className="mt-4 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Session List */}
      {!selectedSession && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => loadSessionDetail(session.id)}
              disabled={detailLoading}
              className="w-full glass-card p-4 text-left hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-white font-medium capitalize">
                    {session.exerciseId.replace(/_/g, ' ')}
                  </div>
                  <div className="text-white/40 text-xs mt-1">
                    {new Date(session.startedAt).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="text-right">
                  {session.avgFormScore != null && (
                    <div
                      className="text-2xl font-bold font-mono"
                      style={{ color: `var(--score-${scoreToColor(session.avgFormScore)})` }}
                    >
                      {session.avgFormScore}%
                    </div>
                  )}
                  <div className="text-white/40 text-xs">
                    {session.totalReps ?? '?'} reps · {session.setLogs?.length ?? '?'} sets
                  </div>
                </div>
              </div>

              {/* Set score bars */}
              {session.setLogs && session.setLogs.length > 0 && (
                <div className="flex gap-1 mt-3">
                  {session.setLogs.map((set, i) => (
                    <div
                      key={i}
                      className="flex-1 h-1.5 rounded-full"
                      style={{
                        backgroundColor: set.avgFormScore != null
                          ? `var(--score-${scoreToColor(set.avgFormScore)})`
                          : 'rgba(255,255,255,0.1)',
                      }}
                    />
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Session Detail */}
      {selectedSession && (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="glass-card p-6">
            <div className="text-center">
              <div className="text-white/40 text-sm uppercase tracking-wider">Exercise</div>
              <div className="text-2xl font-bold text-white mt-1 capitalize">
                {selectedSession.exerciseId.replace(/_/g, ' ')}
              </div>

              {selectedSession.avgFormScore != null && (
                <div
                  className="text-5xl font-bold font-mono mt-4"
                  style={{ color: `var(--score-${scoreToColor(selectedSession.avgFormScore)})` }}
                >
                  {selectedSession.avgFormScore}%
                </div>
              )}
              <div className="text-white/40 text-sm mt-1">Average Form Score</div>

              <div className="grid grid-cols-3 gap-4 mt-6 text-center">
                <div>
                  <div className="text-xl font-bold text-white">
                    {selectedSession.totalReps ?? '—'}
                  </div>
                  <div className="text-white/40 text-xs">Total Reps</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">
                    {selectedSession.setLogs?.length ?? '—'}
                  </div>
                  <div className="text-white/40 text-xs">Sets</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">
                    {(() => {
                      if (!selectedSession.endedAt || !selectedSession.startedAt) return '—';
                      const ms = new Date(selectedSession.endedAt).getTime() - new Date(selectedSession.startedAt).getTime();
                      return isNaN(ms) || ms < 0 ? '—' : `${Math.round(ms / 60000)}m`;
                    })()}
                  </div>
                  <div className="text-white/40 text-xs">Duration</div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Summary */}
          {selectedSession.aiSummary && (
            <div className="glass-card p-4 border-l-2 border-gym-cyan">
              <div className="text-gym-cyan text-xs font-bold uppercase mb-1">AI Summary</div>
              <div className="text-white/80 text-sm">{selectedSession.aiSummary}</div>
            </div>
          )}

          {/* Sets breakdown */}
          {selectedSession.setLogs && selectedSession.setLogs.length > 0 && (
            <div className="glass-card p-4">
              <div className="text-white/40 text-xs font-bold uppercase mb-3">Sets</div>
              <div className="space-y-2">
                {selectedSession.setLogs.map((set) => (
                  <div key={set.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                    <div className="text-white/70 text-sm">Set {set.setNumber}</div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-white/50">{set.repsCount} reps</span>
                      {set.avgFormScore != null && (
                        <span
                          className="font-mono font-bold"
                          style={{ color: `var(--score-${scoreToColor(set.avgFormScore)})` }}
                        >
                          {set.avgFormScore}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
