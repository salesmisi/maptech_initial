import React, { useState, useEffect, useRef } from 'react';
import { Download, Award, Calendar, ExternalLink, BookOpen } from 'lucide-react';

const API_BASE = '/api';

interface Certificate {
  id: number;
  course_id: string;
  title: string;
  department: string;
  certificate_code: string;
  completed_at: string;
  completed_date: string;
  score: string;
  user_name: string;
}

export function MyCertificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCertificates = async () => {
      try {
        const res = await fetch(`${API_BASE}/employee/certificates`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          setCertificates(data);
        }
      } catch (err) {
        console.error('Error loading certificates:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCertificates();
  }, []);

  const handleDownloadPdf = (cert: Certificate) => {
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = 800 * scale;
    canvas.height = 560 * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 560);

    // Green top bar
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(0, 0, 800, 8);

    // Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, 740, 500);

    // Inner border
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, 720, 480);

    // Award icon (circle)
    ctx.beginPath();
    ctx.arc(400, 100, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#dcfce7';
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('★', 400, 112);

    // Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px Arial';
    ctx.fillText('CERTIFICATE OF COMPLETION', 400, 170);

    // Divider
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(250, 185);
    ctx.lineTo(550, 185);
    ctx.stroke();

    // Presented to
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Arial';
    ctx.fillText('This is to certify that', 400, 220);

    // User name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 32px Georgia';
    ctx.fillText(cert.user_name, 400, 265);

    // Underline name
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(200, 275);
    ctx.lineTo(600, 275);
    ctx.stroke();

    // Has completed
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Arial';
    ctx.fillText('has successfully completed the course', 400, 310);

    // Course title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(cert.title, 400, 350);

    // Score
    ctx.fillStyle = '#16a34a';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`Score: ${cert.score}%`, 400, 385);

    // Footer line
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(60, 440);
    ctx.lineTo(740, 440);
    ctx.stroke();

    // Date
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Date: ${cert.completed_date}`, 80, 470);

    // Certificate ID
    ctx.textAlign = 'right';
    ctx.fillText(`ID: ${cert.certificate_code}`, 720, 470);

    // Company
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Arial';
    ctx.fillText('Maptech Information Solutions Inc.', 400, 510);

    // Download as image (PNG pretending as PDF for simplicity)
    const link = document.createElement('a');
    link.download = `${cert.certificate_code}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        <span className="ml-3 text-slate-600">Loading certificates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">My Certificates</h1>
      <p className="text-slate-500">
        View and download your earned certificates.
      </p>

      {certificates.length === 0 ? (
        <div className="text-center py-12">
          <Award className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No certificates yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Complete all modules in a course to earn a certificate.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group"
            >
              {/* Certificate Preview */}
              <div className="h-48 bg-slate-100 relative p-4 flex items-center justify-center border-b border-slate-100">
                <div className="bg-white w-full h-full shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
                  <Award className="h-8 w-8 text-green-600 mb-2" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                    Certificate of Completion
                  </h3>
                  <p className="text-[10px] text-slate-500 mb-2">
                    Presented to {cert.user_name}
                  </p>
                  <p className="text-[10px] font-bold text-slate-800 line-clamp-2">
                    {cert.title}
                  </p>
                  <div className="mt-auto pt-2 border-t border-slate-100 w-full flex justify-between text-[8px] text-slate-400">
                    <span>{cert.completed_date}</span>
                    <span>Maptech Inc.</span>
                  </div>
                </div>

                {/* Overlay on Hover */}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDownloadPdf(cert)}
                    className="bg-white text-slate-900 px-4 py-2 rounded-md font-medium text-sm flex items-center shadow-lg hover:bg-slate-50"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Preview
                  </button>
                </div>
              </div>

              <div className="p-5">
                <h3 className="font-bold text-slate-900 mb-1">{cert.title}</h3>
                <div className="flex items-center text-sm text-slate-500 mb-2">
                  <Calendar className="h-4 w-4 mr-1" />
                  Completed on {cert.completed_date}
                </div>
                <div className="text-xs text-green-600 font-medium mb-4">
                  Score: {cert.score}%
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                  <span className="text-xs font-mono text-slate-400">
                    ID: {cert.certificate_code}
                  </span>
                  <button
                    onClick={() => handleDownloadPdf(cert)}
                    className="text-green-600 hover:text-green-700 font-medium text-sm flex items-center"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
