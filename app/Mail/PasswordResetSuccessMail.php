<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * PasswordResetSuccessMail
 *
 * Sends a confirmation email after the user has successfully reset their password.
 * This serves as both a confirmation and a security notification.
 */
class PasswordResetSuccessMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * The user's name for personalization.
     */
    public string $userName;

    /**
     * Create a new message instance.
     *
     * @param string $userName The user's display name
     */
    public function __construct(string $userName)
    {
        $this->userName = $userName;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Password Reset Successful - Maptech LearnHub',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.password-reset-success',
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
