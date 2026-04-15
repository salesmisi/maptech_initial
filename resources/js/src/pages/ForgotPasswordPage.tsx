import React, { useState, useEffect, useRef } from 'react';
import { Mail, ArrowRight, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
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
 * Allows users to request a password reset by entering their email address.
 * Features:
 * - Email validation
 * - Loading states
 * - Error/success messaging
 * - Video background with fallback
 * - Dark/light theme support
 */
interface ForgotPasswordPageProps {
  /** Callback when user wants to go back to login */
  onBackToLogin: () => void;
  /** Callback when OTP is successfully sent */
  onOTPSent: (email: string, maskedEmail?: string) => void;
  /** Current theme */
  theme: 'light' | 'dark';
}

export function ForgotPasswordPage({ onBackToLogin, onOTPSent, theme }: ForgotPasswordPageProps) {
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
   * Handles form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate email
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      // Fetch CSRF cookie first
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const xsrfToken = getCookie('XSRF-TOKEN');

      const response = await fetch('/api/password/forgot', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || ''),
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset code. Please try again.');
      }

      setSuccess(true);

      // Wait a moment then navigate to OTP verification
      // Pass the masked email (where OTP was actually sent - personal gmail for admins)
      setTimeout(() => {
        onOTPSent(email.trim(), data.masked_email);
      }, 1500);

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
          Enter your email to receive a verification code
        </p>
      </div>

      {/* Form Card */}
      <div
        className={`relative z-10 mt-5 sm:mx-auto sm:w-full sm:max-w-md transform transition-all duration-700 delay-150 ${
          pageReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className={`backdrop-blur-sm py-6 px-4 shadow sm:rounded-lg sm:px-8 border-t-4 border-green-500 ${isDark ? 'bg-slate-950/75' : 'bg-white/90'}`}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Email Input */}
            <div>
              <label htmlFor="reset-email" className={`block text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
                Email address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="reset-email"
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

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="rounded-md bg-green-50 p-4 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">
                  Verification code sent! Redirecting...
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
                    Sending...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Code Sent!
                  </>
                ) : (
                  <>
                    Send Verification Code
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
        </div>
      </div>

      <BusinessFooter isDark={isDark} />
    </div>
  );
}

export default ForgotPasswordPage;
