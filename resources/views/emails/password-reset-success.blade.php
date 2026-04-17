<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Successful</title>
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
            margin-bottom: 20px;
        }
        .success-box {
            background-color: #dcfce7;
            border: 1px solid #16a34a;
            border-radius: 8px;
            padding: 25px;
            text-align: center;
            margin: 30px 0;
        }
        .success-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }
        .success-text {
            font-size: 18px;
            font-weight: 600;
            color: #15803d;
            margin: 0;
        }
        .info-notice {
            background-color: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 15px 20px;
            margin: 25px 0;
            border-radius: 0 8px 8px 0;
        }
        .info-notice p {
            margin: 0;
            color: #1e40af;
            font-size: 14px;
        }
        .security-tips {
            background-color: #f8fafc;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
        }
        .security-tips h3 {
            margin: 0 0 15px 0;
            color: #1e293b;
            font-size: 16px;
        }
        .security-tips ul {
            margin: 0;
            padding-left: 20px;
            color: #475569;
        }
        .security-tips li {
            margin-bottom: 8px;
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
                <h1>✅ Password Reset Complete</h1>
            </div>

            <!-- Content -->
            <div class="content">
                <p class="greeting">Hello {{ $userName }},</p>

                <!-- Success Box -->
                <div class="success-box">
                    <div class="success-icon">🎉</div>
                    <p class="success-text">Your password has been successfully reset!</p>
                </div>

                <p class="message">
                    Your Maptech LearnHub account password has been changed.
                    You can now log in with your new password.
                </p>

                <!-- Info Notice -->
                <div class="info-notice">
                    <p><strong>📅 Password Changed:</strong> {{ date('F j, Y \a\t g:i A') }}</p>
                </div>

                <!-- Security Tips -->
                <div class="security-tips">
                    <h3>🛡️ Security Tips</h3>
                    <ul>
                        <li>Keep your password confidential and do not share it with anyone.</li>
                        <li>Use a unique password that you don't use for other accounts.</li>
                        <li>If you didn't make this change, contact your administrator immediately.</li>
                        <li>Consider enabling additional security measures if available.</li>
                    </ul>
                </div>

                <p class="message">
                    If you did not initiate this password reset, please contact your system administrator
                    immediately as your account may have been compromised.
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
