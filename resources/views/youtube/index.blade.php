<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My YouTube Uploads - Maptech LMS</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="max-w-6xl mx-auto py-8 px-4">
        <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div class="flex justify-between items-center">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900">My YouTube Uploads</h1>
                    <p class="text-gray-500 mt-1">View your uploaded videos from YouTube</p>
                </div>
                @isset($authenticated)
                    @if($authenticated)
                        <form action="{{ route('youtube.logout') }}" method="POST">
                            @csrf
                            <button type="submit" class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition">
                                Disconnect YouTube
                            </button>
                        </form>
                    @endif
                @endisset
            </div>
        </div>

        @if(session('success'))
            <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-6">
                {{ session('success') }}
            </div>
        @endif

        @if(session('error'))
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
                {{ session('error') }}
            </div>
        @endif

        @if(isset($error) && $error)
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <svg class="mx-auto h-12 w-12 text-yellow-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <h3 class="text-lg font-semibold text-yellow-800 mb-2">Configuration Required</h3>
                <p class="text-yellow-700">{{ $message ?? 'An error occurred.' }}</p>

                @if(str_contains($message ?? '', 'credentials'))
                    <div class="mt-4 p-4 bg-gray-100 rounded text-left text-sm text-gray-700">
                        <p class="font-semibold mb-2">Add these to your .env file:</p>
                        <code class="block bg-gray-800 text-green-400 p-3 rounded">
                            YOUTUBE_CLIENT_ID=your_client_id_here<br>
                            YOUTUBE_CLIENT_SECRET=your_client_secret_here
                        </code>
                    </div>
                @endif
            </div>
        @elseif(empty($videos))
            <div class="bg-white rounded-lg shadow-sm p-12 text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
                <h3 class="text-lg font-medium text-gray-900 mb-2">No Videos Found</h3>
                <p class="text-gray-500">You don't have any uploaded videos on your YouTube channel.</p>
            </div>
        @else
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @foreach($videos as $video)
                    <div class="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition">
                        <a href="https://www.youtube.com/watch?v={{ $video['id'] }}" target="_blank" class="block">
                            @if($video['thumbnail'])
                                <img src="{{ $video['thumbnail'] }}" alt="{{ $video['title'] }}" class="w-full h-48 object-cover">
                            @else
                                <div class="w-full h-48 bg-gray-200 flex items-center justify-center">
                                    <svg class="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                    </svg>
                                </div>
                            @endif
                        </a>
                        <div class="p-4">
                            <h3 class="font-semibold text-gray-900 line-clamp-2 mb-2">
                                <a href="https://www.youtube.com/watch?v={{ $video['id'] }}" target="_blank" class="hover:text-red-600">
                                    {{ $video['title'] }}
                                </a>
                            </h3>
                            <p class="text-sm text-gray-500 line-clamp-2 mb-2">{{ $video['description'] ?: 'No description' }}</p>
                            <div class="flex items-center justify-between text-xs text-gray-400">
                                <span>{{ $video['channelTitle'] }}</span>
                                <span>{{ \Carbon\Carbon::parse($video['publishedAt'])->format('M d, Y') }}</span>
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>
        @endif

        <div class="mt-8 text-center">
            <a href="/" class="text-green-600 hover:text-green-700 font-medium">
                &larr; Back to Dashboard
            </a>
        </div>
    </div>
</body>
</html>
