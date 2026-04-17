import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, CheckCircle, AlertCircle, RefreshCw, Shield } from 'lucide-react';
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
 * VerifyOTPPage Component
 *
 * Handles OTP verification for password reset.
 * Features:
 * - 6-digit OTP input with auto-focus
 * - Countdown timer for OTP expiry
 * - Resend OTP functionality
 * - Paste support for OTP
 * - Auto-submit on complete entry
 */
interface VerifyOTPPageProps {
  /** Email address used for login (work email) */
  email: string;
  /** Masked email where OTP was sent (may be personal gmail for admins) */
  maskedEmail?: string;
  /** Callback when user wants to go back to forgot password */
  onBack: () => void;
  /** Callback when OTP is verified successfully */
  onVerified: (email: string, resetToken: string) => void;
  /** Current theme */
  theme: 'light' | 'dark';
}

export function VerifyOTPPage({ email, maskedEmail, onBack, onVerified, theme }: VerifyOTPPageProps) {
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoSrcIndex, setVideoSrcIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [countdown, setCountdown] = useState(15 * 60); // 15 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60); // 60 seconds before resend

  const loginVideoSources = ['/assets/loginvid.mp4', '/loginvid.mp4'];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isDark = theme === 'dark';
  const activeVideoSource = loginVideoSources[videoSrcIndex];

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

  // OTP expiry countdown
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Resend countdown
  useEffect(() => {
    if (canResend) return;

    const timer = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [canResend]);

  // Focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleVideoError = () => {
    if (videoSrcIndex < loginVideoSources.length - 1) {
      setVideoSrcIndex((index) => index + 1);
      return;
    }
    setVideoFailed(true);
  };

  /**
   * Formats seconds to MM:SS
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Handles individual digit input
   */
  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d*$/.test(value)) return;

    const newOtp = [...otp];

    // Handle paste of full OTP
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      digits.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit;
      });
      setOtp(newOtp);

      // Focus last filled input or last input
      const lastIndex = Math.min(digits.length - 1, 5);
      if (inputRefs.current[lastIndex]) {
        inputRefs.current[lastIndex]?.focus();
      }
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  /**
   * Handles backspace navigation
   */
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Handles paste event
   */
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('');

    if (digits.length > 0) {
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit;
      });
      setOtp(newOtp);

      // Focus appropriate input
      const focusIndex = Math.min(digits.length, 5);
      if (inputRefs.current[focusIndex]) {
        inputRefs.current[focusIndex]?.focus();
      }
    }
  };

  /**
   * Verifies the OTP
   */
  const verifyOTP = useCallback(async () => {
    const otpCode = otp.join('');

    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Fetch CSRF cookie first
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const xsrfToken = getCookie('XSRF-TOKEN');

      const response = await fetch('/api/password/verify-otp', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || ''),
        },
        body: JSON.stringify({ email, otp: otpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid verification code.');
      }

      setSuccess(true);

      // Navigate to reset password page
      setTimeout(() => {
        onVerified(email, data.reset_token);
      }, 1000);

    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
      // Clear OTP on error for retry
      setOtp(['', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    } finally {
      setLoading(false);
    }
  }, [email, otp, onVerified]);

  // Auto-submit when all digits are entered
  useEffect(() => {
    if (otp.every((digit) => digit !== '') && !loading && !success) {
      verifyOTP();
    }
  }, [otp, loading, success, verifyOTP]);

  /**
   * Resends OTP
   */
  const handleResend = async () => {
    if (!canResend || resending) return;

    setResending(true);
    setError('');

    try {
      // Fetch CSRF cookie first
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const xsrfToken = getCookie('XSRF-TOKEN');

      const response = await fetch('/api/password/resend-otp', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': decodeURIComponent(xsrfToken || ''),
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to resend code.');
      }

      // Reset countdown
      setCountdown(15 * 60);
      setCanResend(false);
      setResendCountdown(60);
      setOtp(['', '', '', '', '', '']);

      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }

    } catch (err: any) {
      setError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  /**
   * Masks email for display
   */
  const maskEmail = (email: string): string => {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;

    const maskedLocal = local.length > 3
      ? local.slice(0, 2) + '***' + local.slice(-1)
      : local[0] + '***';

    return `${maskedLocal}@${domain}`;
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
          Verify Your Email
        </h2>
        <p
          className={`mt-2 text-center text-sm ${isDark ? 'text-slate-200' : 'text-slate-100'}`}
          style={{ textShadow: '0 2px 12px rgba(2, 6, 23, 0.7)' }}
        >
          Enter the 6-digit code sent to {maskedEmail || maskEmail(email)}
        </p>
      </div>

      {/* Form Card */}
      <div
        className={`relative z-10 mt-5 sm:mx-auto sm:w-full sm:max-w-md transform transition-all duration-700 delay-150 ${
          pageReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className={`backdrop-blur-sm py-6 px-4 shadow sm:rounded-lg sm:px-8 border-t-4 border-green-500 ${isDark ? 'bg-slate-950/75' : 'bg-white/90'}`}>
          {/* Timer */}
          <div className="text-center mb-6">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
              countdown > 60 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <Shield className="h-4 w-4" />
              <span className="font-mono font-semibold">
                {countdown > 0 ? `Code expires in ${formatTime(countdown)}` : 'Code expired'}
              </span>
            </div>
          </div>

          {/* OTP Input */}
          <div className="flex justify-center gap-2 sm:gap-3 mb-6" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={loading || success || countdown === 0}
                className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold rounded-lg border-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all ${
                  isDark
                    ? 'border-slate-600 bg-slate-800 text-white'
                    : 'border-slate-300 bg-white text-slate-900'
                } ${digit ? 'border-green-500' : ''} disabled:opacity-50`}
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-50 p-4 flex items-start gap-3 mb-4">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="rounded-md bg-green-50 p-4 flex items-start gap-3 mb-4">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">
                Verification successful! Redirecting...
              </p>
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-center mb-4">
              <svg className="animate-spin h-8 w-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}

          {/* Resend Code */}
          <div className="text-center mb-4">
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Didn't receive the code?{' '}
              {canResend ? (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className={`font-medium inline-flex items-center ${
                    isDark ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-700'
                  } disabled:opacity-50`}
                >
                  {resending ? (
                    <>
                      <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                      Resending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-1 h-4 w-4" />
                      Resend Code
                    </>
                  )}
                </button>
              ) : (
                <span className="font-medium text-slate-400">
                  Resend in {resendCountdown}s
                </span>
              )}
            </p>
          </div>

          {/* Back Link */}
          <div className="text-center">
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className={`text-sm font-medium inline-flex items-center hover:underline ${
                isDark ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-700'
              } disabled:opacity-50`}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Use Different Email
            </button>
          </div>
        </div>
      </div>

      <BusinessFooter isDark={isDark} />
    </div>
  );
}

export default VerifyOTPPage;
