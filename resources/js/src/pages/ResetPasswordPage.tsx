import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowRight, Check, X } from 'lucide-react';
import { BusinessFooter } from '../components/business/BusinessFooter';

/**
 * Helper to get a cookie by name
 */
function getCookie(name: string): string {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
  return '';
}

/**
 * ResetPasswordPage Component
 *
 * Allows users to set a new password after OTP verification.
 * Features:
 * - Password strength requirements validation
 * - Show/hide password toggle
 * - Real-time password validation feedback
 * - Confirmation password matching
 */
interface ResetPasswordPageProps {
  /** User's email address */
  email: string;
  /** Reset token from OTP verification */
  resetToken: string;
  /** Callback when password is successfully reset */
  onSuccess: () => void;
  /** Callback to go back to login */
  onBackToLogin: () => void;
  /** Current theme */
  theme: 'light' | 'dark';
}

interface PasswordRequirement {
  id: string;
  label: string;
  validator: (password: string) => boolean;
}

export function ResetPasswordPage({ email, resetToken, onSuccess, onBackToLogin, theme }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoSrcIndex, setVideoSrcIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);

  const loginVideoSources = ['/assets/loginvid.mp4', '/loginvid.mp4'];
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isDark = theme === 'dark';
  const activeVideoSource = loginVideoSources[videoSrcIndex];

  /**
   * Password requirements as per the specification:
   * - At least 8 characters long
   * - At least one uppercase letter
   * - At least one special character
   * - At least two numbers
   */
  const passwordRequirements: PasswordRequirement[] = [
    {
      id: 'length',
      label: 'At least 8 characters',
      validator: (pwd) => pwd.length >= 8,
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A-Z)',
      validator: (pwd) => /[A-Z]/.test(pwd),
    },
    {
      id: 'special',
      label: 'At least one special character (!@#$%^&*...)',
      validator: (pwd) => /[!@#$%^&*(),.?":{}|<>_\-=+\[\]\\\/`~;']/.test(pwd),
    },
    {
      id: 'numbers',
      label: 'At least two numbers (0-9)',
      validator: (pwd) => (pwd.match(/[0-9]/g) || []).length >= 2,
    },
  ];

  // Check if all requirements are met
  const allRequirementsMet = passwordRequirements.every((req) => req.validator(password));
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // Page ready animation
  useEffect(() => {
    const timer = window.setTimeout(() => setPageReady(true), 30);
    return () => window.clearTimeout(timer);
  }, []);

  // Video playback
  useEffect(() => {
    if (videoFailed || !videoRef.current) return;

    const video = videoRef.current;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch(() => {});
    }
  }, [activeVideoSource, videoFailed]);

  const handleVideoError = () => {
    if (videoSrcIndex < loginVideoSources.length - 1) {
      setVideoSrcIndex((index) => index + 1);
      return;
    }
    setVideoFailed(true);
  };

  /**
   * Calculates password strength percentage
   */
  const getPasswordStrength = (): number => {
    const metCount = passwordRequirements.filter((req) => req.validator(password)).length;
    return (metCount / passwordRequirements.length) * 100;
  };

  /**
   * Gets password strength label and color
   */
  const getStrengthInfo = (): { label: string; color: string; bgColor: string } => {
    const strength = getPasswordStrength();
    if (strength === 100) return { label: 'Strong', color: 'text-green-600', bgColor: 'bg-green-500' };
    if (strength >= 75) return { label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-500' };
    if (strength >= 50) return { label: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-500' };
    if (strength >= 25) return { label: 'Weak', color: 'text-orange-600', bgColor: 'bg-orange-500' };
    return { label: 'Very Weak', color: 'text-red-600', bgColor: 'bg-red-500' };
  };

  /**
   * Handles form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password requirements
    if (!allRequirementsMet) {
      setError('Please ensure your password meets all requirements.');
      return;
    }

    // Validate passwords match
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // Fetch CSRF cookie first
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const xsrfToken = getCookie('XSRF-TOKEN');

      const response = await fetch('/api/password/reset', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || ''),
        },
        body: JSON.stringify({
          email,
          token: resetToken,
          password,
          password_confirmation: confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password.');
      }

      setSuccess(true);

      // Navigate back to login after success
      setTimeout(() => {
        onSuccess();
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const strengthInfo = getStrengthInfo();

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Background */}
      <div className="absolute inset-0 bg-slate-950" aria-hidden="true" />

      {!videoFailed && (
        <video
          key={activeVideoSource}
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
          src={activeVideoSource}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onLoadStart={() => setVideoReady(false)}
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
          onError={handleVideoError}
        />
      )}

      {videoFailed && (
        <div
          className="absolute inset-0 h-full w-full bg-cover bg-center"
          style={{ backgroundImage: 'url(/assets/pasted-image.jpg)' }}
          aria-hidden="true"
        />
      )}

      <div
        className={`absolute inset-0 bg-slate-950/70 transition-opacity duration-500 ${videoReady ? 'opacity-100' : 'opacity-90'}`}
        aria-hidden="true"
      />

      {/* Logo and Header */}
      <div
        className={`relative z-10 sm:mx-auto sm:w-full sm:max-w-md transform transition-all duration-700 delay-100 ${
          pageReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 -top-14 h-56 w-80 -translate-x-1/2 rounded-full bg-cyan-300/22 blur-3xl"
        />
        <div className="flex justify-center">
          <img
            className="h-20 sm:h-28 md:h-32 w-auto drop-shadow-[0_14px_36px_rgba(0,0,0,0.58)]"
            src="/assets/Maptech-Official-Logo.png"
            alt="Maptech LearnHub"
          />
        </div>
        <h2
          className={`mt-4 text-center text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-50'}`}
          style={{ textShadow: '0 4px 18px rgba(2, 6, 23, 0.75)' }}
        >
          Create New Password
        </h2>
        <p
          className={`mt-2 text-center text-sm ${isDark ? 'text-slate-200' : 'text-slate-100'}`}
          style={{ textShadow: '0 2px 12px rgba(2, 6, 23, 0.7)' }}
        >
          Your new password must meet all requirements below
        </p>
      </div>

      {/* Form Card */}
      <div
        className={`relative z-10 mt-5 sm:mx-auto sm:w-full sm:max-w-md transform transition-all duration-700 delay-150 ${
          pageReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className={`backdrop-blur-sm py-6 px-4 shadow sm:rounded-lg sm:px-8 border-t-4 border-green-500 ${isDark ? 'bg-slate-950/75' : 'bg-white/90'}`}>
          {success ? (
            // Success State
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Password Reset Successful!
              </h3>
              <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Your password has been updated. Redirecting to login...
              </p>
              <button
                type="button"
                onClick={onBackToLogin}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Go to Login
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          ) : (
            // Form State
            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* New Password */}
              <div>
                <label htmlFor="new-password" className={`block text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
                  New Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="new-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className={`block w-full pl-10 pr-10 border rounded-md py-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 ${
                      isDark ? 'border-slate-700 bg-slate-900/80 text-slate-100' : 'border-slate-300 bg-white text-slate-900'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {/* Password Strength Bar */}
                {password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs ${strengthInfo.color}`}>Password Strength: {strengthInfo.label}</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${strengthInfo.bgColor} transition-all duration-300`}
                        style={{ width: `${getPasswordStrength()}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Password Requirements */}
              <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <p className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  Password Requirements:
                </p>
                <ul className="space-y-1">
                  {passwordRequirements.map((req) => {
                    const isMet = req.validator(password);
                    return (
                      <li key={req.id} className="flex items-center gap-2 text-sm">
                        {isMet ? (
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        )}
                        <span className={isMet ? 'text-green-600' : isDark ? 'text-slate-400' : 'text-slate-500'}>
                          {req.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirm-password" className={`block text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
                  Confirm Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className={`block w-full pl-10 pr-10 border rounded-md py-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 ${
                      isDark ? 'border-slate-700 bg-slate-900/80 text-slate-100' : 'border-slate-300 bg-white text-slate-900'
                    } ${confirmPassword && !passwordsMatch ? 'border-red-500' : ''} ${passwordsMatch ? 'border-green-500' : ''}`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {confirmPassword && (
                  <p className={`mt-1 text-sm flex items-center gap-1 ${passwordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordsMatch ? (
                      <>
                        <Check className="h-4 w-4" />
                        Passwords match
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4" />
                        Passwords do not match
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-md bg-red-50 p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={loading || !allRequirementsMet || !passwordsMatch}
                  className="w-full flex justify-center py-2 px-4 rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Resetting Password...
                    </>
                  ) : (
                    <>
                      Reset Password
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <BusinessFooter isDark={isDark} />
    </div>
  );
}

export default ResetPasswordPage;
