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
  Cell,
  LineChart,
  Line } from
'recharts';
import { Download, Calendar } from 'lucide-react';

const COLORS = ['#22c55e', '#eab308', '#94a3b8'];

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
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(6);
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/reports?months=${range}`, {
      headers: { 'Accept': 'application/json', 'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') },
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((d: ReportData) => setData(d))
      .finally(() => setLoading(false));
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">
          Reports &amp; Analytics
        </h1>
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
            {exporting ? 'Exporting…' : 'Export Report'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall Completion Status */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Overall Completion Status
          </h3>
          {loading ? (
            <div className="h-80 flex items-center justify-center text-slate-400">Loading…</div>
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
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value">
                      {completionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                    <Legend />
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
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Enrollment vs Completion Trends
          </h3>
          <div className="h-80">
            {loading ? (
              <div className="flex items-center justify-center h-full text-slate-400">Loading…</div>
            ) : monthlyTrends.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400">No trend data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="enrollments" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="completions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Most Popular Courses */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Most Popular Courses
          </h3>
          {loading ? (
            <div className="h-80 flex items-center justify-center text-slate-400">Loading…</div>
          ) : popularCourses.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-slate-400">No course enrollment data yet</div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popularCourses} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={160}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + '…' : v}
                  />
                  <Tooltip formatter={(value) => [value, 'Enrolled Students']} />
                  <Bar dataKey="students" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={28}>
                    {popularCourses.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#16a34a' : i === 1 ? '#22c55e' : '#4ade80'} />
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
