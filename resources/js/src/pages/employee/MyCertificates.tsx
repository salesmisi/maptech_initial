import React, { useState, useEffect, useRef } from 'react';
import { Download, Award, Calendar, ExternalLink, BookOpen, Upload, Trash2, Image } from 'lucide-react';

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
}

export function MyCertificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
  };

  const getHeaders = () => ({
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-XSRF-TOKEN': decodeURIComponent(getCookie('XSRF-TOKEN') || ''),
  });

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

  const handleUploadLogo = (certId: number) => {
    setUploadingId(certId);
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) return;

    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await fetch(`${API_BASE}/employee/certificates/${uploadingId}/logo`, {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to upload logo');
        return;
      }
      loadCertificates();
    } catch {
      alert('Upload failed');
    } finally {
      setUploadingId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async (certId: number) => {
    if (!window.confirm('Remove logo from this certificate?')) return;
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    try {
      await fetch(`${API_BASE}/employee/certificates/${certId}/logo`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getHeaders(),
      });
      loadCertificates();
    } catch {
      alert('Failed to remove logo');
    }
  };

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

    // Award icon or uploaded logo
    if (logoImg) {
      // Draw the uploaded logo centered at top
      const maxW = 80, maxH = 60;
      const ratio = Math.min(maxW / logoImg.width, maxH / logoImg.height);
      const w = logoImg.width * ratio;
      const h = logoImg.height * ratio;
      ctx.drawImage(logoImg, 400 - w / 2, 70, w, h);
    } else {
      ctx.beginPath();
      ctx.arc(400, 100, 30, 0, Math.PI * 2);
      ctx.fillStyle = '#dcfce7';
      ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('★', 400, 112);
    }

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
        View and download your earned certificates. You can upload a custom logo for each certificate.
      </p>

      {/* Hidden file input for logo upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileSelected}
        accept="image/png,image/jpeg,image/jpg,image/svg+xml"
        className="hidden"
      />

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
                  {cert.logo_url ? (
                    <img src={cert.logo_url} alt="Logo" className="h-8 w-auto mb-2 object-contain" />
                  ) : (
                    <Award className="h-8 w-8 text-green-600 mb-2" />
                  )}
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
                  <div className="flex items-center gap-2">
                    {cert.logo_url ? (
                      <button
                        onClick={() => handleRemoveLogo(cert.id)}
                        className="text-red-500 hover:text-red-700 text-sm flex items-center"
                        title="Remove logo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      onClick={() => handleUploadLogo(cert.id)}
                      className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
                      title={cert.logo_url ? 'Change logo' : 'Upload logo'}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Logo
                    </button>
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
