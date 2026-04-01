import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Mail,
  Lock,
  Camera,
  Save,
  Shield,
  Building2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  PenTool,
} from 'lucide-react';
import { LoadingState } from '../../components/ui/LoadingState';

const API_BASE = '/api';

interface ProfileData {
  id: number;
  fullName: string;
  email: string;
  role: string;
  department: string | null;
  status: string;
  profile_picture: string | null;
  signature_path: string | null;
}

function getXsrfToken(): string {
  const v = `; ${document.cookie}`;
  const parts = v.split('; XSRF-TOKEN=');
  return parts.length === 2 ? decodeURIComponent(parts.pop()?.split(';').shift() || '') : '';
}

async function getCsrf() {
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
}

export function ProfileSettings() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPicPreview, setShowPicPreview] = useState(false);
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const signatureDrawingRef = useRef(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data: ProfileData = await res.json();
        setProfile(data);
        setFullName(data.fullName);
        setEmail(data.email);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      await getCsrf();
      const body: Record<string, string> = {};
      if (fullName !== profile?.fullName) body.fullName = fullName;
      if (email !== profile?.email) body.email = email;
      if (password) {
        body.password = password;
        body.password_confirmation = passwordConfirmation;
      }

      if (Object.keys(body).length === 0) {
        setMessage({ type: 'error', text: 'No changes to save.' });
        setSaving(false);
        return;
      }

      const res = await fetch(`${API_BASE}/profile`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': getXsrfToken(),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const errors = data.errors ? Object.values(data.errors).flat().join(' ') : data.message;
        setMessage({ type: 'error', text: errors || 'Failed to update profile.' });
      } else {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setProfile((prev) => prev ? { ...prev, fullName: data.user.fullName, email: data.user.email } : prev);
        setPassword('');
        setPasswordConfirmation('');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPic(true);
    setMessage(null);

    try {
      await getCsrf();
      const formData = new FormData();
      formData.append('profile_picture', file);

      const res = await fetch(`${API_BASE}/profile/picture`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-XSRF-TOKEN': getXsrfToken(),
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const errors = data.errors ? Object.values(data.errors).flat().join(' ') : data.message;
        setMessage({ type: 'error', text: errors || 'Failed to upload picture.' });
      } else {
        setMessage({ type: 'success', text: 'Profile picture updated!' });
        setProfile((prev) => prev ? { ...prev, profile_picture: data.profile_picture } : prev);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to upload picture.' });
    } finally {
      setUploadingPic(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const uploadSignatureFile = async (file: File): Promise<boolean> => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      setMessage({ type: 'error', text: 'Signature must be a PNG or JPG image.' });
      return false;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Signature file is too large. Maximum size is 2MB.' });
      return false;
    }

    setUploadingSignature(true);
    setMessage(null);

    try {
      await getCsrf();
      const formData = new FormData();
      formData.append('signature', file);

      const res = await fetch(`${API_BASE}/profile/signature`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-XSRF-TOKEN': getXsrfToken(),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        const errors = data.errors ? Object.values(data.errors).flat().join(' ') : data.message;
        setMessage({ type: 'error', text: errors || 'Failed to upload signature.' });
        return false;
      } else {
        setMessage({ type: 'success', text: 'Signature uploaded. It will now be used automatically in certificates.' });
        setProfile((prev) => prev ? { ...prev, signature_path: data.signature_path } : prev);
        return true;
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to upload signature.' });
      return false;
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadSignatureFile(file);
    if (signatureInputRef.current) signatureInputRef.current.value = '';
  };

  const getSignatureCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startSignatureDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (uploadingSignature) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const point = getSignatureCanvasPoint(e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);

    signatureDrawingRef.current = true;
    setHasDrawnSignature(true);
    canvas.setPointerCapture(e.pointerId);
  };

  const moveSignatureDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!signatureDrawingRef.current) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const point = getSignatureCanvasPoint(e);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const endSignatureDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!signatureDrawingRef.current) return;
    moveSignatureDraw(e);
    signatureDrawingRef.current = false;
  };

  const clearSignaturePad = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  };

  const uploadDrawnSignature = async () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    if (!hasDrawnSignature) {
      setMessage({ type: 'error', text: 'Please draw a signature first.' });
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      setMessage({ type: 'error', text: 'Failed to capture drawn signature.' });
      return;
    }

    const file = new File([blob], `signature-${Date.now()}.png`, { type: 'image/png' });
    const ok = await uploadSignatureFile(file);
    if (ok) {
      clearSignaturePad();
    }
  };

  const roleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'instructor': return 'bg-amber-100 text-amber-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const avatarBg = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'bg-green-500';
      case 'instructor': return 'bg-amber-500';
      default: return 'bg-green-500';
    }
  };

  if (loading) {
    return (
      <LoadingState message="Loading profile" size="lg" className="min-h-[40vh]" />
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-2 text-sm text-slate-600">Failed to load profile data.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>

      {/* Message Banner */}
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {message.text}
        </div>
      )}

      {/* Profile Picture Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Profile Picture</h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            {profile.profile_picture ? (
              <img
                src={profile.profile_picture}
                alt="Profile"
                className="h-24 w-24 rounded-full object-cover border-4 border-slate-100 cursor-pointer hover:ring-2 hover:ring-green-400 transition"
                onClick={() => setShowPicPreview(true)}
              />
            ) : (
              <div className={`h-24 w-24 rounded-full ${avatarBg(profile.role)} flex items-center justify-center text-white text-3xl font-bold border-4 border-slate-100`}>
                {profile.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPic}
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition-colors shadow-md"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/gif"
              onChange={handlePictureUpload}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{profile.fullName}</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${roleColor(profile.role)}`}>
              <Shield className="h-3 w-3 mr-1" />
              {profile.role}
            </span>
            <p className="text-xs text-slate-500 mt-2">
              JPG, PNG or GIF. Max 2MB.
            </p>
            {uploadingPic && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                Uploading...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Instructor Signature Section */}
      {profile.role.toLowerCase() === 'instructor' && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Certificate Signature</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-full sm:w-72">
              <div
                className="h-24 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer overflow-hidden"
                onClick={() => profile.signature_path && setShowSignaturePreview(true)}
              >
                {profile.signature_path ? (
                  <img
                    src={profile.signature_path}
                    alt="Signature"
                    className="max-h-20 max-w-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-500 text-center px-3">
                    No signature uploaded yet
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1">
              <p className="text-sm text-slate-700">
                Upload your signature once and it will be used automatically for all generated certificates.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                PNG/JPG only, max 2MB. Uploading again replaces the previous signature.
              </p>

              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-600">Draw signature using mouse, touch, or pen tablet.</p>
                <canvas
                  ref={signatureCanvasRef}
                  width={900}
                  height={260}
                  className="mt-2 w-full h-28 rounded-md border border-dashed border-slate-300 bg-white cursor-crosshair touch-none"
                  onPointerDown={startSignatureDraw}
                  onPointerMove={moveSignatureDraw}
                  onPointerUp={endSignatureDraw}
                  onPointerLeave={endSignatureDraw}
                  onPointerCancel={endSignatureDraw}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={clearSignaturePad}
                    disabled={uploadingSignature}
                    className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Clear Drawing
                  </button>
                  <button
                    type="button"
                    onClick={uploadDrawnSignature}
                    disabled={uploadingSignature}
                    className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save Drawn Signature
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  disabled={uploadingSignature}
                  className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  <PenTool className="h-4 w-4 mr-2" />
                  {profile.signature_path ? 'Replace Signature' : 'Upload Signature'}
                </button>
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />
              </div>

              {uploadingSignature && (
                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                  Uploading signature...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Information */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Account Information</h2>

        {/* Read-only fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md border border-slate-200">
              <Shield className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-700">{profile.role}</span>
            </div>
          </div>
          {profile.department && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md border border-slate-200">
                <Building2 className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-700">{profile.department}</span>
              </div>
            </div>
          )}
        </div>

        {/* Editable form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-400" />
              </div>
              {profile.role.toLowerCase() === 'admin' ? (
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  required
                />
              ) : (
                <div className="block w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700">
                  {profile.email}
                </div>
              )}
            </div>
          </div>

          {profile.role.toLowerCase() === 'admin' && (
          <div className="border-t border-slate-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Change Password</h3>
            <p className="text-xs text-slate-500 mb-3">Leave blank to keep your current password.</p>

            <div className="space-y-3">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="password_confirmation" className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="password_confirmation"
                    type={showConfirm ? 'text' : 'password'}
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    placeholder="Re-enter new password"
                    className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Profile Picture Preview Modal */}
      {showPicPreview && profile.profile_picture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowPicPreview(false)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={profile.profile_picture}
              alt={profile.fullName}
              className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
            />
            <button
              onClick={() => setShowPicPreview(false)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-md hover:bg-slate-100 text-lg font-bold"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Signature Preview Modal */}
      {showSignaturePreview && profile.signature_path && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowSignaturePreview(false)}>
          <div className="relative bg-white rounded-lg p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={profile.signature_path}
              alt="Signature preview"
              className="max-w-[90vw] max-h-[70vh] rounded object-contain"
            />
            <button
              onClick={() => setShowSignaturePreview(false)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-md hover:bg-slate-100 text-lg font-bold"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
