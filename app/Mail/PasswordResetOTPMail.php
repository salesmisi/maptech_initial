<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * PasswordResetOTPMail
 *
 * Sends a 6-digit OTP to the user for password reset verification.
 * The OTP expires after 15 minutes for security purposes.
 */
class PasswordResetOTPMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * The OTP code to send.
     */
    public string $otp;

    /**
     * The user's name for personalization.
     */
    public string $userName;

    /**
     * Create a new message instance.
     *
     * @param string $otp The 6-digit OTP code
     * @param string $userName The user's display name
     */
    public function __construct(string $otp, string $userName)
    {
        $this->otp = $otp;
        $this->userName = $userName;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Password Reset Verification Code - Maptech LearnHub',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.password-reset-otp',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
