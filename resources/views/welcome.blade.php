<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Maptech E-Learning</title>

    @viteReactRefresh
    @vite('resources/js/src/index.tsx')
</head>
<body>

    <div id="app"></div>

</body>
</html>
