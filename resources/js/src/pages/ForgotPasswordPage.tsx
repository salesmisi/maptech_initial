import React, { useState, useEffect, useRef } from 'react';
import { Mail, ArrowRight, ArrowLeft, CheckCircle, AlertCircle, Key, Eye, EyeOff } from 'lucide-react';
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
 * ForgotPasswordPage Component
 *
 * Allows users to reset password using their recovery key.
 * Features:
 * - Recovery key validation
 * - Password reset
 * - New recovery key generation
 * - Video background with fallback
 * - Dark/light theme support
 */
interface ForgotPasswordPageProps {
  /** Callback when user wants to go back to login */
  onBackToLogin: () => void;
  /** Callback when OTP is successfully sent (kept for compatibility) */
  onOTPSent?: (email: string, maskedEmail?: string) => void;
  /** Current theme */
  theme: 'light' | 'dark';
}

export function ForgotPasswordPage({ onBackToLogin, theme }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoSrcIndex, setVideoSrcIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const loginVideoSources = ['/assets/loginvid.mp4', '/loginvid.mp4'];
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Recovery key state
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newRecoveryKey, setNewRecoveryKey] = useState<string | null>(null);
  const [copiedNewKey, setCopiedNewKey] = useState(false);

  const isDark = theme === 'dark';
  const activeVideoSource = loginVideoSources[videoSrcIndex];

  useEffect(() => {
    const timer = window.setTimeout(() => setPageReady(true), 30);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (videoFailed || !videoRef.current) return;

    const video = videoRef.current;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch(() => {
        // Keep poster fallback behavior
      });
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
   * Validates email format
   */
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Handles recovery key password reset
   */
  const handleRecoveryKeyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setNewRecoveryKey(null);

    // Validate email
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    // Validate recovery key format (XXXX-XXXX-XXXX-XXXX)
    const cleanKey = recoveryKey.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanKey)) {
      setError('Recovery key must be in format XXXX-XXXX-XXXX-XXXX');
      return;
    }

    // Validate new password
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError('Password must contain at least one uppercase letter.');
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>_\-=+\[\]\\\/`~;']/.test(newPassword)) {
      setError('Password must contain at least one special character.');
      return;
    }

    const numberCount = (newPassword.match(/[0-9]/g) || []).length;
    if (numberCount < 2) {
      setError('Password must contain at least two numbers.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const xsrfToken = getCookie('XSRF-TOKEN');

      const response = await fetch('/api/password/reset-with-recovery-key', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || ''),
        },
        body: JSON.stringify({
          email: email.trim(),
          recovery_key: cleanKey,
          password: newPassword,
          password_confirmation: confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password. Please try again.');
      }

      setSuccess(true);

      // Show the new recovery key if provided
      if (data.new_recovery_key) {
        setNewRecoveryKey(data.new_recovery_key);
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          Forgot Password?
        </h2>
        <p
          className={`mt-2 text-center text-sm ${isDark ? 'text-slate-200' : 'text-slate-100'}`}
          style={{ textShadow: '0 2px 12px rgba(2, 6, 23, 0.7)' }}
        >
          Use your recovery key to reset your password
        </p>
      </div>

      {/* Form Card */}
      <div
        className={`relative z-10 mt-5 sm:mx-auto sm:w-full sm:max-w-md transform transition-all duration-700 delay-150 ${
          pageReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className={`backdrop-blur-sm py-6 px-4 shadow sm:rounded-lg sm:px-8 border-t-4 border-green-500 ${isDark ? 'bg-slate-950/75' : 'bg-white/90'}`}>
          {/* Recovery Key Form */}
          {!newRecoveryKey && (
          <form className="space-y-4" onSubmit={handleRecoveryKeyReset}>
            {/* Email Input */}
            <div>
              <label htmlFor="recovery-email" className={`block text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
                Email address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || success}
                  className={`block w-full pl-10 border rounded-md py-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 ${
                    isDark ? 'border-slate-700 bg-slate-900/80 text-slate-100' : 'border-slate-300 bg-white text-slate-900'
                  }`}
                  placeholder="name@maptech.com"
                />
              </div>
            </div>

            {/* Recovery Key Input */}
            <div>
              <label htmlFor="recovery-key" className={`block text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
                Recovery Key
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="recovery-key"
                  name="recovery_key"
                  type="text"
                  required
                  value={recoveryKey}
                  onChange={(e) => {
                    // Auto-format with dashes
                    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    if (val.length > 16) val = val.slice(0, 16);
                    const parts = val.match(/.{1,4}/g) || [];
                    setRecoveryKey(parts.join('-'));
                  }}
                  disabled={loading || success}
                  className={`block w-full pl-10 border rounded-md py-2 font-mono tracking-wider focus:ring-green-500 focus:border-green-500 disabled:opacity-50 ${
                    isDark ? 'border-slate-700 bg-slate-900/80 text-slate-100' : 'border-slate-300 bg-white text-slate-900'
                  }`}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  maxLength={19}
                />
              </div>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Enter the recovery key you received when your account was created.
              </p>
            </div>

            {/* New Password Input */}
            <div>
              <label htmlFor="new-password" className={`block text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
                New Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  id="new-password"
                  name="new_password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading || success}
                  className={`block w-full pr-10 border rounded-md py-2 px-3 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 ${
                    isDark ? 'border-slate-700 bg-slate-900/80 text-slate-100' : 'border-slate-300 bg-white text-slate-900'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                  )}
                </button>
              </div>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Min 8 chars, 1 uppercase, 1 special char, 2 numbers
              </p>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirm-password" className={`block text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
                Confirm Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  id="confirm-password"
                  name="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading || success}
                  className={`block w-full pr-10 border rounded-md py-2 px-3 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 ${
                    isDark ? 'border-slate-700 bg-slate-900/80 text-slate-100' : 'border-slate-300 bg-white text-slate-900'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && !newRecoveryKey && (
              <div className="rounded-md bg-green-50 p-4 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">
                  Password reset successful! You can now sign in.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading || success}
                className="w-full flex justify-center py-2 px-4 rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Resetting...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Password Reset!
                  </>
                ) : (
                  <>
                    Reset Password
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            {/* Back to Login Link */}
            <div className="text-center">
              <button
                type="button"
                onClick={onBackToLogin}
                disabled={loading}
                className={`text-sm font-medium inline-flex items-center hover:underline ${
                  isDark ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-700'
                } disabled:opacity-50`}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to Sign In
              </button>
            </div>
          </form>
          )}

          {/* New Recovery Key Display after successful reset */}
          {newRecoveryKey && (
            <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-4 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">Password reset successful!</p>
                  <p className="text-sm text-green-700 mt-1">A new recovery key has been generated for you.</p>
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-amber-50 border-amber-200'}`}>
                <p className={`text-sm font-medium mb-2 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                  ⚠️ Save your new recovery key:
                </p>
                <div className="relative">
                  <code className={`block w-full rounded-lg px-4 py-3 text-lg font-mono tracking-wider text-center select-all ${
                    isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900 border border-amber-300'
                  }`}>
                    {newRecoveryKey}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newRecoveryKey);
                      setCopiedNewKey(true);
                      setTimeout(() => setCopiedNewKey(false), 2000);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedNewKey ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    )}
                  </button>
                </div>
                {copiedNewKey && (
                  <p className="mt-2 text-sm text-green-600">✓ Copied to clipboard</p>
                )}
                <p className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-amber-700'}`}>
                  Your old recovery key is no longer valid. Store this new key securely.
                </p>
              </div>

              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full flex justify-center py-2 px-4 rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"
              >
                Continue to Sign In
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <BusinessFooter isDark={isDark} />
    </div>
  );
}

export default ForgotPasswordPage;
