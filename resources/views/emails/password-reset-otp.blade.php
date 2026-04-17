<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Code</title>
    <style>
        /* Reset styles for email clients */
        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f7fa;
            line-height: 1.6;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #16a34a 0%, #059669 100%);
            padding: 30px 40px;
            text-align: center;
        }
        .header img {
            max-height: 60px;
            margin-bottom: 10px;
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 40px;
        }
        .greeting {
            font-size: 18px;
            color: #1e293b;
            margin-bottom: 20px;
        }
        .message {
            font-size: 16px;
            color: #475569;
            margin-bottom: 30px;
        }
        .otp-container {
            background-color: #f8fafc;
            border: 2px dashed #16a34a;
            border-radius: 8px;
            padding: 25px;
            text-align: center;
            margin: 30px 0;
        }
        .otp-label {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .otp-code {
            font-size: 36px;
            font-weight: 700;
            color: #16a34a;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
        }
        .expiry-notice {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px 20px;
            margin: 25px 0;
            border-radius: 0 8px 8px 0;
        }
        .expiry-notice p {
            margin: 0;
            color: #92400e;
            font-size: 14px;
        }
        .security-notice {
            background-color: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 15px 20px;
            margin: 25px 0;
            border-radius: 0 8px 8px 0;
        }
        .security-notice p {
            margin: 0;
            color: #991b1b;
            font-size: 14px;
        }
        .footer {
            background-color: #f8fafc;
            padding: 25px 40px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        .footer p {
            margin: 5px 0;
            color: #64748b;
            font-size: 13px;
        }
        .company-name {
            font-weight: 600;
            color: #16a34a;
        }
    </style>
</head>
<body>
    <div style="padding: 20px;">
        <div class="email-container">
            <!-- Header -->
            <div class="header">
                <h1>🔐 Password Reset</h1>
            </div>

            <!-- Content -->
            <div class="content">
                <p class="greeting">Hello {{ $userName }},</p>

                <p class="message">
                    We received a request to reset your password for your Maptech LearnHub account.
                    Use the verification code below to proceed with your password reset.
                </p>

                <!-- OTP Code -->
                <div class="otp-container">
                    <p class="otp-label">Your Verification Code</p>
                    <p class="otp-code">{{ $otp }}</p>
                </div>

                <!-- Expiry Notice -->
                <div class="expiry-notice">
                    <p><strong>⏰ Important:</strong> This code will expire in <strong>15 minutes</strong>.
                    If the code expires, you'll need to request a new one.</p>
                </div>

                <!-- Security Notice -->
                <div class="security-notice">
                    <p><strong>🛡️ Security Notice:</strong> If you did not request a password reset,
                    please ignore this email or contact your administrator immediately.
                    Your account remains secure.</p>
                </div>

                <p class="message">
                    For your security, please do not share this code with anyone.
                </p>
            </div>

            <!-- Footer -->
            <div class="footer">
                <p class="company-name">Maptech Information Solutions Inc.</p>
                <p>LearnHub - Learning Management System</p>
                <p>&copy; {{ date('Y') }} All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
