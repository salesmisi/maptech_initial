import React, { useState, useEffect } from 'react';
import { Download, Award, Calendar, ExternalLink, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { safeArray } from '../../utils/safe';

const API_BASE = '/api';
const MAPTECH_LOGO_URL = '/assets/Maptech-Official-Logo.png';

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
  signer_name?: string | null;
  signer_title?: string | null;
  admin_signature_url?: string | null;
}

export function MyCertificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewCert, setPreviewCert] = useState<Certificate | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const generateCertificateImage = async (cert: Certificate): Promise<string | null> => {
    const loadImage = async (url?: string | null): Promise<HTMLImageElement | null> => {
      if (!url) return null;
      return new Promise<HTMLImageElement | null>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });
    };

    const presidentName  = cert.signer_name  || null;
    const presidentTitle = cert.signer_title || null;
    const instructorName = cert.instructor_name || 'Instructor';

    const [maptechLogoImg, partnerLogoImg, adminSigImg, instructorSigImg] = await Promise.all([
      loadImage(MAPTECH_LOGO_URL),
      loadImage(cert.logo_url),
      loadImage(cert.admin_signature_url),
      loadImage(cert.instructor_signature_url),
    ]);

    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = 1000 * scale;
    canvas.height = 700 * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);

    const pageW = 1000;
    const pageH = 700;

    const wrapText = (text: string, maxWidth: number, font: string) => {
      ctx.font = font;
      const words = (text || '').trim().split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = '';

      words.forEach((word) => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth) {
          line = test;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      });

      if (line) lines.push(line);
      return lines;
    };

    const drawCenteredLines = (
      lines: string[],
      centerX: number,
      startY: number,
      lineHeight: number,
      font: string,
      color: string,
    ) => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      lines.forEach((line, idx) => ctx.fillText(line, centerX, startY + idx * lineHeight));
    };

    // Background with subtle warm tint for a cleaner premium look
    const bg = ctx.createLinearGradient(0, 0, 0, pageH);
    bg.addColorStop(0, '#fcfdfb');
    bg.addColorStop(1, '#f6f8f4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, pageW, pageH);

    // Frame system
    ctx.strokeStyle = '#115b45';
    ctx.lineWidth = 10;
    ctx.strokeRect(18, 18, 964, 664);

    ctx.lineWidth = 2;
    ctx.strokeRect(32, 32, 936, 636);
    ctx.strokeRect(42, 42, 916, 616);

    // Top logo row: Maptech (left) + partner (right, when mapped)
    const drawLogoInBox = (img: HTMLImageElement | null, x: number, y: number, w: number, h: number) => {
      if (!img) return;
      const ratio = Math.min((w - 16) / img.width, (h - 16) / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      ctx.drawImage(img, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
    };

    drawLogoInBox(maptechLogoImg, 74, 58, 284, 92);

    if (partnerLogoImg) {
      drawLogoInBox(partnerLogoImg, 642, 58, 284, 92);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f6a4f';
      ctx.font = '700 20px Georgia';
      ctx.fillText('★', 784, 102);
      ctx.fillStyle = '#3f5d53';
      ctx.font = '600 11px Arial';
      ctx.fillText('Collaborating Brand', 784, 124);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '600 12px Arial';
    ctx.fillText('Maptech Information Solutions Inc.', 216, 170);
    if (partnerLogoImg) {
      ctx.fillText('Collaborating Brand', 784, 170);
    }

    const contentShiftY = 12;

    // Title block
    ctx.fillStyle = '#0f6a4f';
    ctx.font = '700 54px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('Certificate of Achievement', 500, 220 + contentShiftY);

    ctx.strokeStyle = '#0f6a4f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(288, 244 + contentShiftY);
    ctx.lineTo(712, 244 + contentShiftY);
    ctx.stroke();

    ctx.fillStyle = '#1f2937';
    ctx.font = '700 26px Georgia';
    ctx.fillText('This certifies that', 500, 288 + contentShiftY);

    // Recipient name (auto-fit up to 2 lines)
    let nameSize = 48;
    let nameLines: string[] = [];
    while (nameSize >= 30) {
      nameLines = wrapText(cert.user_name || 'Learner', 760, `700 ${nameSize}px Georgia`);
      if (nameLines.length <= 2) break;
      nameSize -= 2;
    }
    const nameLineHeight = Math.round(nameSize * 1.1);
    drawCenteredLines(nameLines.slice(0, 2), 500, 352 + contentShiftY, nameLineHeight, `700 ${nameSize}px Georgia`, '#0f172a');

    const nameBottomY = 352 + contentShiftY + (Math.max(1, nameLines.slice(0, 2).length) - 1) * nameLineHeight;
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(170, nameBottomY + 14);
    ctx.lineTo(830, nameBottomY + 14);
    ctx.stroke();

    // Achievement statement
    ctx.fillStyle = '#334155';
    ctx.font = '600 20px Georgia';
    ctx.fillText('has successfully completed the course requirements for', 500, nameBottomY + 56);

    // Course title (auto-fit up to 2 lines)
    let titleSize = 36;
    let titleLines: string[] = [];
    while (titleSize >= 20) {
      titleLines = wrapText(cert.title || 'Course', 780, `700 ${titleSize}px Georgia`);
      if (titleLines.length <= 2) break;
      titleSize -= 2;
    }
    const titleStartY = nameBottomY + 108;
    const titleLineHeight = Math.round(titleSize * 1.15);
    drawCenteredLines(titleLines.slice(0, 2), 500, titleStartY, titleLineHeight, `700 ${titleSize}px Georgia`, '#0f172a');

    const titleBottomY = titleStartY + (Math.max(1, titleLines.slice(0, 2).length) - 1) * titleLineHeight;
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(200, titleBottomY + 12);
    ctx.lineTo(800, titleBottomY + 12);
    ctx.stroke();

    // Footer rows
    const footerY = Math.min(610, Math.max(596, titleBottomY + 56));
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Left underline (date)
    ctx.moveTo(70, footerY);
    ctx.lineTo(310, footerY);
    // Center underline (president) — only if admin signer exists
    if (presidentName) {
      ctx.moveTo(360, footerY);
      ctx.lineTo(640, footerY);
    }
    // Right underline (instructor)
    ctx.moveTo(700, footerY);
    ctx.lineTo(940, footerY);
    ctx.stroke();

    // Date block (left): date above line, label centered below line
    const dateCenterX = 190;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#334155';
    ctx.font = 'italic 20px Georgia';
    ctx.fillText(cert.completed_date, dateCenterX, footerY - 8);
    ctx.font = 'italic 18px Georgia';
    ctx.fillText('Date of Completion', dateCenterX, footerY + 22);

    // Helper to draw a signer block (signature image + name + role) centered at given x
    const drawSignerBlock = (
      sigImg: HTMLImageElement | null,
      name: string,
      title: string,
      centerX: number,
    ) => {
      if (sigImg) {
        const maxSigW = 200;
        const maxSigH = 52;
        const ratio = Math.min(maxSigW / sigImg.width, maxSigH / sigImg.height);
        const sigW = sigImg.width * ratio;
        const sigH = sigImg.height * ratio;
        // Use multiply blend: white background becomes transparent, dark ink stays dark
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(sigImg, centerX - sigW / 2, footerY - 68, sigW, sigH);
        ctx.restore();
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1f2937';
      ctx.font = '700 18px Georgia';
      ctx.fillText(name, centerX, footerY - 10);
      ctx.fillStyle = '#334155';
      ctx.font = 'italic 17px Georgia';
      ctx.fillText(title, centerX, footerY + 26);
    };

    // Center block — President (only if admin signer exists)
    if (presidentName) {
      drawSignerBlock(adminSigImg, presidentName, presidentTitle ?? 'Administrator', 500);
    }

    // Right block — Instructor
    drawSignerBlock(instructorSigImg, instructorName, 'Instructor', 820);

    // Certificate code
    const certIdY = Math.min(648, footerY + 46);
    ctx.strokeStyle = '#c6d0d8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(332, certIdY - 4);
    ctx.lineTo(430, certIdY - 4);
    ctx.moveTo(570, certIdY - 4);
    ctx.lineTo(668, certIdY - 4);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#5f7182';
    ctx.font = '600 13px Arial';
    ctx.fillText(`Certificate ID: ${cert.certificate_code}`, 500, certIdY);

    // Return image data for preview/download consumers.
    return canvas.toDataURL('image/png');
  };

  const handleDownloadPdf = async (cert: Certificate) => {
    const dataUrl = await generateCertificateImage(cert);
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `${cert.certificate_code}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handlePreview = async (cert: Certificate) => {
    setPreviewLoading(true);
    setPreviewCert(cert);
    setPreviewOpen(true);
    const dataUrl = await generateCertificateImage(cert);
    setPreviewImage(dataUrl);
    setPreviewLoading(false);
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
        View and download your earned certificates. Product logos are mapped automatically based on the completed course.
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
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <img src={MAPTECH_LOGO_URL} alt="Maptech Logo" className="h-8 w-auto max-w-[120px] object-contain" />
                    {cert.logo_url ? (
                      <img src={cert.logo_url} alt="Partner Logo" className="h-8 w-auto max-w-[120px] object-contain" />
                    ) : (
                      <Award className="h-6 w-6 text-green-600" />
                    )}
                  </div>
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
                    <span>{cert.signer_name || cert.instructor_name || 'Instructor'}</span>
                  </div>
                </div>

                {/* Overlay on Hover */}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handlePreview(cert)}
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

      {previewOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4" onClick={() => { setPreviewOpen(false); setPreviewImage(null); setPreviewCert(null); }}>
          <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate pr-2">
                {previewCert ? `${previewCert.title} Certificate Preview` : 'Certificate Preview'}
              </h3>
              <button
                type="button"
                onClick={() => { setPreviewOpen(false); setPreviewImage(null); setPreviewCert(null); }}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-100 p-0 overflow-auto max-h-[calc(92vh-58px)] flex items-start justify-center">
              {previewLoading && (
                <div className="text-slate-600 text-sm p-4">Rendering certificate preview...</div>
              )}
              {!previewLoading && previewImage && (
                <img src={previewImage} alt="Certificate Preview" className="w-full h-auto max-w-4xl shadow-lg border border-slate-200" />
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
