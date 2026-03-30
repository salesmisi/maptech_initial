<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Maptech E-Learning</title>
    <link rel="preload" href="/assets/loginvid.mp4" as="video" type="video/mp4">
    <link rel="preload" href="/assets/pasted-image.jpg" as="image">

    <style>
        html,
        body {
            height: 100%;
            margin: 0;
            background: #020617;
            color: #e2e8f0;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        }

        #app {
            min-height: 100%;
        }

        .login-shell {
            position: relative;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            isolation: isolate;
            background: radial-gradient(circle at 50% 18%, rgba(34, 197, 94, 0.22), transparent 32%), #020617;
        }

        .login-shell::before {
            content: "";
            position: absolute;
            inset: 0;
            background-image: url('/assets/pasted-image.jpg');
            background-size: cover;
            background-position: center;
            opacity: 0.75;
            transform: scale(1.03);
            animation: shellFadeIn 520ms ease-out;
        }

        .login-shell::after {
            content: "";
            position: absolute;
            inset: 0;
            background: rgba(2, 6, 23, 0.65);
        }

        .login-shell-content {
            position: relative;
            z-index: 1;
            text-align: center;
            padding: 1.5rem;
            animation: shellLiftIn 520ms ease-out;
        }

        .login-shell-logo {
            width: 200px;
            max-width: 58vw;
            height: auto;
        }

        .login-shell-text {
            margin-top: 1rem;
            font-size: 0.92rem;
            letter-spacing: 0.03em;
            color: rgba(226, 232, 240, 0.95);
        }

        .login-shell-bar {
            width: 180px;
            height: 4px;
            margin: 0.8rem auto 0;
            border-radius: 9999px;
            overflow: hidden;
            background: rgba(226, 232, 240, 0.22);
        }

        .login-shell-bar > span {
            display: block;
            height: 100%;
            width: 100%;
            border-radius: 9999px;
            background: #22c55e;
            animation: shellPulse 1.2s ease-in-out infinite;
            transform-origin: center;
        }

        @keyframes shellFadeIn {
            from { opacity: 0; }
            to { opacity: 0.75; }
        }

        @keyframes shellLiftIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes shellPulse {
            0%,
            100% {
                opacity: 0.5;
                transform: scaleX(0.76);
            }
            50% {
                opacity: 1;
                transform: scaleX(1);
            }
        }
    </style>

    @viteReactRefresh
    @vite('resources/js/src/index.tsx')
</head>
<body>

    <div id="app">
        <div class="login-shell" aria-hidden="true">
            <div class="login-shell-content">
                <img class="login-shell-logo" src="/assets/Maptech-Official-Logo.png" alt="Maptech LearnHub">
                <p class="login-shell-text">Loading LearnHub...</p>
                <div class="login-shell-bar"><span></span></div>
            </div>
        </div>
    </div>

</body>
</html>