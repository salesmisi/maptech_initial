import React, { useState, useEffect } from 'react';
import { Download, Award, Calendar, ExternalLink } from 'lucide-react';
import { safeArray } from '../../utils/safe';

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
  logo_url: string | null;
  instructor_name: string;
  instructor_signature_url: string | null;
}

export function MyCertificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCertificates = async () => {
    try {
      const res = await fetch(`${API_BASE}/employee/certificates`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        setCertificates(await res.json());
      }
    } catch (err) {
      console.error('Error loading certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const handleDownloadPdf = async (cert: Certificate) => {
    // If there's a logo, load it first
    let logoImg: HTMLImageElement | null = null;
    if (cert.logo_url) {
      logoImg = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = cert.logo_url!;
      });
    }

    let signatureImg: HTMLImageElement | null = null;
    if (cert.instructor_signature_url) {
      signatureImg = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = cert.instructor_signature_url!;
      });
    }

    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = 1000 * scale;
    canvas.height = 700 * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 700);

    // Outer green frame matching the provided template
    ctx.strokeStyle = '#0f6a4f';
    ctx.lineWidth = 14;
    ctx.strokeRect(16, 16, 968, 668);

    // Inner frame
    ctx.lineWidth = 3;
    ctx.strokeRect(34, 34, 932, 632);

    // Product logo (if mapped), centered near top
    if (logoImg) {
      const maxW = 150, maxH = 85;
      const ratio = Math.min(maxW / logoImg.width, maxH / logoImg.height);
      const w = logoImg.width * ratio;
      const h = logoImg.height * ratio;
      ctx.drawImage(logoImg, 500 - w / 2, 58, w, h);
    } else {
      ctx.beginPath();
      ctx.arc(500, 95, 26, 0, Math.PI * 2);
      ctx.fillStyle = '#ecfdf5';
      ctx.fill();
      ctx.fillStyle = '#0f6a4f';
      ctx.font = 'bold 26px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText('★', 500, 104);
    }

    // Main heading
    ctx.fillStyle = '#0f6a4f';
    ctx.font = 'bold 68px Georgia';
    ctx.fillText('Certificate of Achievement', 500, 200);

    // Heading ornament line
    ctx.strokeStyle = '#0f6a4f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(235, 228);
    ctx.lineTo(765, 228);
    ctx.stroke();
    ctx.fillStyle = '#0f6a4f';
    ctx.beginPath();
    ctx.moveTo(500, 218);
    ctx.lineTo(514, 228);
    ctx.lineTo(500, 238);
    ctx.lineTo(486, 228);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 54px Times New Roman';
    ctx.fillText('This certifies that:', 500, 292);

    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, 308);
    ctx.lineTo(800, 308);
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 58px Times New Roman';
    ctx.fillText(cert.user_name, 500, 372);

    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(140, 392);
    ctx.lineTo(860, 392);
    ctx.stroke();

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 50px Times New Roman';
    ctx.fillText('has successfully completed the requirements', 500, 462);
    ctx.fillText('of the seminar for', 500, 520);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 54px Times New Roman';
    ctx.fillText(cert.title, 500, 580);

    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, 598);
    ctx.lineTo(800, 598);
    ctx.stroke();

    // Footer section
    ctx.font = 'italic 42px Times New Roman';
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'left';
    ctx.fillText(`Date: ${cert.completed_date}`, 120, 645);

    ctx.textAlign = 'right';
    ctx.fillText('Instructor', 880, 645);

    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(120, 652);
    ctx.lineTo(360, 652);
    ctx.moveTo(640, 652);
    ctx.lineTo(880, 652);
    ctx.stroke();

    if (signatureImg) {
      const maxSigW = 220;
      const maxSigH = 70;
      const ratio = Math.min(maxSigW / signatureImg.width, maxSigH / signatureImg.height);
      const sigW = signatureImg.width * ratio;
      const sigH = signatureImg.height * ratio;
      ctx.drawImage(signatureImg, 760 - sigW / 2, 575, sigW, sigH);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 24px Times New Roman';
    ctx.fillText(cert.instructor_name || 'Instructor', 760, 675);

    // Certificate code
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6b7280';
    ctx.font = '18px Arial';
    ctx.fillText(`Certificate ID: ${cert.certificate_code}`, 500, 695);

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
        View and download your earned certificates. Product logos are mapped automatically based on your completed modules and lessons.
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
          {safeArray(certificates).map((cert) => (
            <div
              key={cert.id}
              className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group"
            >
              {/* Certificate Preview */}
              <div className="h-48 bg-slate-100 relative p-4 flex items-center justify-center border-b border-slate-100">
                <div className="bg-white w-full h-full shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
                  {cert.logo_url ? (
                    <img src={cert.logo_url} alt="Logo" className="h-8 w-auto mb-2 object-contain" />
                  ) : (
                    <Award className="h-8 w-8 text-green-600 mb-2" />
                  )}
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                    Certificate of Achievement
                  </h3>
                  <p className="text-[10px] text-slate-500 mb-2">
                    Presented to {cert.user_name}
                  </p>
                  <p className="text-[10px] font-bold text-slate-800 line-clamp-2">
                    {cert.title}
                  </p>
                  <div className="mt-auto pt-2 border-t border-slate-100 w-full flex justify-between text-[8px] text-slate-400">
                    <span>{cert.completed_date}</span>
                    <span>{cert.instructor_name || 'Instructor'}</span>
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadPdf(cert)}
                      className="text-green-600 hover:text-green-700 font-medium text-sm flex items-center"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
