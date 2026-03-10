import React, { useEffect, useState } from 'react';

type DashboardData = {
  coursesCount: number;
  studentsCount: number;
  quizzesCount: number;
};

export function InstructorDashboard(): JSX.Element {
  const [data, setData] = useState<DashboardData>({
    coursesCount: 0,
    studentsCount: 0,
    quizzesCount: 0,
  });

  useEffect(() => {
    let mounted = true;
    fetch('/api/instructor/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error('network');
        return res.json();
      })
      .then((json) => {
        if (mounted && json) {
          setData((d) => ({ ...d, ...json }));
        }
      })
      .catch(() => {
        // ignore — leave defaults
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: 'Segoe UI, Roboto, Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 8 }}>Instructor Dashboard</h1>
      <p style={{ color: '#555', marginTop: 0 }}>Summary of your teaching activity</p>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Courses</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{data.coursesCount}</div>
        </div>

        <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Students</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{data.studentsCount}</div>
        </div>

        <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Quizzes</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{data.quizzesCount}</div>
        </div>
      </div>

      <section style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Recent Activity</h2>
        <div style={{ color: '#6b7280' }}>No recent activity to show.</div>
      </section>
    </div>
  );
}
