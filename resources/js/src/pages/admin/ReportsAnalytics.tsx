import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Sector,
  Cell,
  LineChart,
  Line } from
'recharts';
import { Download, Calendar } from 'lucide-react';

const COLORS = ['#34b46c', '#c8a73a', '#7f90ab'];
const POPULAR_COURSE_COLORS = ['#2ea85f', '#3abf6f', '#60ca88'];
const CHART_CARD_CLASS = 'rounded-xl border border-slate-200/70 bg-white/95 p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70';

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '';
}

interface ReportData {
  completion_status: { name: string; value: number }[];
  monthly_trends: { name: string; enrollments: number; completions: number }[];
  popular_courses: { name: string; students: number }[];
}

const RANGE_OPTIONS = [
  { label: 'Last 3 Months', months: 3 },
  { label: 'Last 6 Months', months: 6 },
  { label: 'Last 12 Months', months: 12 },
];

export function ReportsAnalytics() {
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completionHoverIndex, setCompletionHoverIndex] = useState<number | undefined>(undefined);
  const [range, setRange] = useState(6);
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDarkMode(root.classList.contains('dark'));
    });

    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadReports = async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(`/api/admin/reports?months=${range}`, {
          headers: { 'Accept': 'application/json', 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
          credentials: 'include',
        });
        const d: ReportData = await res.json();
        if (!isMounted) return;
        setData(d);
        setLastUpdated(new Date());
      } finally {
        if (showSpinner && isMounted) setLoading(false);
      }
    };

    loadReports(true);
    const intervalId = window.setInterval(() => {
      loadReports(false);
    }, 20000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [range]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/reports/export', {
        headers: { 'Accept': 'text/csv', 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
        credentials: 'include',
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      a.download = match?.[1] ?? 'report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const currentRangeLabel = RANGE_OPTIONS.find((o) => o.months === range)?.label ?? 'Last 6 Months';

  const completionData = data?.completion_status ?? [];
  const monthlyTrends  = data?.monthly_trends ?? [];
  const popularCourses = data?.popular_courses ?? [];
  const chartGridColor = isDarkMode ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.28)';
  const chartAxisTickColor = isDarkMode ? '#a7b0c0' : '#64748b';
  const chartLegendColor = isDarkMode ? '#b8c2d1' : '#475569';
  const completionSliceStroke = isDarkMode ? 'rgba(148, 163, 184, 0.5)' : 'rgba(100, 116, 139, 0.45)';
  const activeRingFill = isDarkMode ? 'rgba(226, 232, 240, 0.42)' : 'rgba(71, 85, 105, 0.28)';
  const trendActiveDotStroke = isDarkMode ? '#0b1220' : '#ffffff';
  const chartTooltipClass = isDarkMode
    ? 'rounded-lg border border-slate-700/60 bg-slate-900/88 px-3 py-2 shadow-md backdrop-blur-sm'
    : 'rounded-lg border border-slate-200/90 bg-white/96 px-3 py-2 shadow-sm backdrop-blur-sm';
  const chartTooltipLabelClass = isDarkMode ? 'text-xs font-medium text-slate-300' : 'text-xs font-medium text-slate-600';

  const renderCompletionTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const entry = payload[0];
    const segmentName = entry?.name ?? entry?.payload?.name ?? 'Status';
    const value = Number(entry?.value ?? 0);
    const segmentColor = entry?.color ?? '#7f90ab';

    return (
      <div className={chartTooltipClass}>
        <p className={chartTooltipLabelClass}>{segmentName}</p>
        <p className="text-sm font-semibold" style={{ color: segmentColor }}>
          {value} learner{value === 1 ? '' : 's'}
        </p>
      </div>
    );
  };

  const renderActiveCompletionSlice = (props: any) => {
    const {
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
    } = props;

    const expansion = Math.max(4, Math.min(8, outerRadius * 0.07));
    const ringGap = Math.max(2, Math.min(4, outerRadius * 0.03));
    const ringThickness = Math.max(2, Math.min(4, outerRadius * 0.035));

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + expansion}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={outerRadius + expansion + ringGap}
          outerRadius={outerRadius + expansion + ringGap + ringThickness}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={activeRingFill}
        />
      </g>
    );
  };

  const renderTrendsTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className={chartTooltipClass}>
        <p className={`mb-1 ${chartTooltipLabelClass}`}>{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  };

  const renderPopularCoursesTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const value = Number(payload[0]?.value ?? 0);
    const color = payload[0]?.color ?? POPULAR_COURSE_COLORS[0];

    return (
      <div className={chartTooltipClass}>
        <p className={chartTooltipLabelClass}>{label}</p>
        <p className="text-sm font-semibold" style={{ color }}>
          Enrolled Students: {value}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">
          Reports &amp; Analytics
        </h1>
        <div className="text-xs text-slate-500 mr-auto ml-4 hidden sm:block">
          Live refresh every 20s{lastUpdated ? ` • Updated ${lastUpdated.toLocaleTimeString()}` : ''}
        </div>
        <div className="flex space-x-3">
          {/* Range picker */}
          <div className="relative">
            <button
              onClick={() => setShowRangeMenu((v) => !v)}
              className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
              <Calendar className="h-4 w-4 mr-2" />
              {currentRangeLabel}
            </button>
            {showRangeMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-md shadow-lg z-20">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.months}
                    onClick={() => { setRange(opt.months); setShowRangeMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${range === opt.months ? 'text-green-600 font-medium' : 'text-slate-700'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export Report'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall Completion Status */}
        <div className={CHART_CARD_CLASS}>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Overall Completion Status
          </h3>
          {loading ? (
            <div className="h-80 flex items-center justify-center text-slate-400">Loading...</div>
          ) : completionData.every((d) => d.value === 0) ? (
            <div className="h-80 flex items-center justify-center text-slate-400">No enrollment data yet</div>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={completionData}
                      cx="50%"
                      cy="48%"
                      activeShape={renderActiveCompletionSlice}
                      onMouseEnter={(_, index) => setCompletionHoverIndex(index)}
                      onMouseLeave={() => setCompletionHoverIndex(undefined)}
                      onClick={(_, index) => setCompletionHoverIndex((prev) => (prev === index ? undefined : index))}
                      innerRadius="56%"
                      outerRadius="78%"
                      paddingAngle={3}
                      stroke={completionSliceStroke}
                      strokeWidth={2}
                      dataKey="value">
                      {completionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={renderCompletionTooltip}
                      cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                      allowEscapeViewBox={{ x: true, y: true }}
                      wrapperStyle={{ zIndex: 25 }}
                    />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ color: chartLegendColor, fontSize: '12px', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {completionData.map((item, i) => (
                  <div key={item.name} className="p-3 rounded-lg" style={{ backgroundColor: COLORS[i] + '15' }}>
                    <p className="text-xl font-bold" style={{ color: COLORS[i] }}>{item.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.name}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Monthly Trends */}
        <div className={CHART_CARD_CLASS}>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Enrollment vs Completion Trends
          </h3>
          <div className="h-80">
            {loading ? (
              <div className="flex items-center justify-center h-full text-slate-400">Loading...</div>
            ) : monthlyTrends.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400">No trend data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="2 6" vertical={false} stroke={chartGridColor} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartAxisTickColor, fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: chartAxisTickColor, fontSize: 12 }} />
                  <Tooltip
                    content={renderTrendsTooltip}
                    cursor={false}
                  />
                  <Legend wrapperStyle={{ color: chartLegendColor, fontSize: '12px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="enrollments" stroke="#2db768" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 5, stroke: trendActiveDotStroke, strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="completions" stroke="#5b8def" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 5, stroke: trendActiveDotStroke, strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Most Popular Courses */}
        <div className={`${CHART_CARD_CLASS} lg:col-span-2`}>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Most Popular Courses
          </h3>
          {loading ? (
            <div className="h-80 flex items-center justify-center text-slate-400">Loading...</div>
          ) : popularCourses.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-slate-400">No course enrollment data yet</div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popularCourses} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={chartGridColor} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: chartAxisTickColor, fontSize: 12 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={160}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: chartAxisTickColor }}
                    tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + '...' : v}
                  />
                  <Tooltip content={renderPopularCoursesTooltip} cursor={{ fill: 'rgba(46, 168, 95, 0.08)' }} />
                  <Bar
                    dataKey="students"
                    fill="#22c55e"
                    radius={[0, 4, 4, 0]}
                    barSize={28}
                    animationDuration={520}
                    activeBar={{
                      fillOpacity: 1,
                      stroke: 'rgba(167, 243, 208, 0.72)',
                      strokeWidth: 1.3,
                      filter: 'drop-shadow(0 0 8px rgba(46, 168, 95, 0.28))',
                    }}
                  >
                    {popularCourses.map((_, i) => (
                      <Cell key={i} fill={POPULAR_COURSE_COLORS[i % POPULAR_COURSE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>);

}
