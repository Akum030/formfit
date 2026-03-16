/**
 * CalendarHeatmap — Monthly workout calendar with intensity-colored days.
 */

interface CalendarDay {
  date: string;
  sessions: number;
  totalReps: number;
  avgScore: number;
}

interface CalendarHeatmapProps {
  data: CalendarDay[];
  month?: number;
  year?: number;
}

export function CalendarHeatmap({ data, month, year }: CalendarHeatmapProps) {
  const now = new Date();
  const currentMonth = month ?? now.getMonth();
  const currentYear = year ?? now.getFullYear();

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const dayMap = new Map<string, CalendarDay>();
  data.forEach((d) => dayMap.set(d.date, d));

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const monthName = firstDay.toLocaleDateString('en', { month: 'long', year: 'numeric' });

  function getDayData(day: number): CalendarDay | undefined {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dayMap.get(dateStr);
  }

  function getIntensity(day: number): number {
    const entry = getDayData(day);
    if (!entry) return 0;
    if (entry.sessions >= 3) return 4;
    if (entry.sessions >= 2) return 3;
    if (entry.avgScore >= 70) return 2;
    return 1;
  }

  const intensityClasses = [
    'bg-white/[0.03] text-white/20',
    'bg-emerald-500/15 text-emerald-300/70',
    'bg-emerald-500/30 text-emerald-200/80',
    'bg-emerald-500/50 text-white/90',
    'bg-emerald-500/70 text-white',
  ];

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-white font-bold text-lg">{monthName}</h3>
        <div className="flex items-center gap-1.5 text-[10px] text-white/30">
          <span>Less</span>
          {intensityClasses.map((c, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded ${c.split(' ')[0]}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-[10px] text-white/25 font-semibold py-1 uppercase tracking-wider">
            {d}
          </div>
        ))}
        {weeks.flat().map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const intensity = getIntensity(day);
          const entry = getDayData(day);
          const isToday =
            day === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear();
          return (
            <div
              key={`d-${day}`}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all duration-200 cursor-default hover:scale-105 ${
                intensityClasses[intensity]
              } ${isToday ? 'ring-2 ring-emerald-400/60 ring-offset-1 ring-offset-gym-900' : ''}`}
              title={
                entry
                  ? `${entry.sessions} workout${entry.sessions > 1 ? 's' : ''} · ${entry.totalReps} reps · ${entry.avgScore}% avg`
                  : ''
              }
            >
              <span className="leading-none">{day}</span>
              {entry && (
                <div className="flex gap-0.5 mt-0.5">
                  {Array.from({ length: Math.min(entry.sessions, 3) }).map((_, j) => (
                    <div key={j} className="w-1 h-1 rounded-full bg-emerald-300/70" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
