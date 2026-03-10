<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Google_Client;
use Google_Service_YouTube;
use Google_Service_YouTube_VideoSnippet;
use Google_Service_YouTube_VideoStatus;
use Google_Service_YouTube_Video;
use Google_Http_MediaFileUpload;
use Google_Service_Exception;
use Google_Exception;

class YouTubeController extends Controller
{
    /**
     * OAuth 2.0 Client Credentials
     * Get these from Google Cloud Console: https://cloud.google.com/console
     * Enable the YouTube Data API for your project.
     */
    private function getClient(): Google_Client
    {
        $client = new Google_Client();
        $client->setClientId(config('services.youtube.client_id'));
        $client->setClientSecret(config('services.youtube.client_secret'));
        $client->setScopes('https://www.googleapis.com/auth/youtube');
        $client->setRedirectUri(route('youtube.callback'));
        $client->setAccessType('offline');
        $client->setPrompt('consent');

        return $client;
    }

    /**
     * Show YouTube uploads page or redirect to auth.
     */
    public function index(Request $request)
    {
        $client = $this->getClient();
        $tokenSessionKey = 'youtube_token';

        // Check if we have a valid access token
        if ($request->session()->has($tokenSessionKey)) {
            $client->setAccessToken($request->session()->get($tokenSessionKey));

            // If token is expired, try to refresh
            if ($client->isAccessTokenExpired()) {
                if ($client->getRefreshToken()) {
                    $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                    $request->session()->put($tokenSessionKey, $client->getAccessToken());
                } else {
                    // Need to re-authorize
                    return $this->redirectToAuth($client, $request);
                }
            }

            return $this->showUploads($client);
        }

        // Check if credentials are configured
        if (config('services.youtube.client_id') === 'REPLACE_ME' || !config('services.youtube.client_id')) {
            return view('youtube.index', [
                'error' => true,
                'message' => 'YouTube API credentials not configured. Please set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in your .env file.',
                'videos' => [],
            ]);
        }

        return $this->redirectToAuth($client, $request);
    }

    /**
     * Handle OAuth callback from Google.
     */
    public function callback(Request $request)
    {
        $client = $this->getClient();
        $tokenSessionKey = 'youtube_token';

        // Verify state to prevent CSRF
        if ($request->session()->get('youtube_state') !== $request->get('state')) {
            return redirect()->route('youtube.index')->with('error', 'Invalid state. Please try again.');
        }

        if ($request->has('code')) {
            $client->authenticate($request->get('code'));
            $request->session()->put($tokenSessionKey, $client->getAccessToken());
        }

        return redirect()->route('youtube.index');
    }

    /**
     * Revoke access and logout from YouTube.
     */
    public function logout(Request $request)
    {
        $client = $this->getClient();
        $tokenSessionKey = 'youtube_token';

        if ($request->session()->has($tokenSessionKey)) {
            $client->setAccessToken($request->session()->get($tokenSessionKey));
            $client->revokeToken();
            $request->session()->forget($tokenSessionKey);
        }

        return redirect()->route('youtube.index')->with('success', 'Successfully disconnected from YouTube.');
    }

    /**
     * Redirect to Google OAuth authorization.
     */
    private function redirectToAuth(Google_Client $client, Request $request)
    {
        $state = bin2hex(random_bytes(16));
        $client->setState($state);
        $request->session()->put('youtube_state', $state);

        return redirect($client->createAuthUrl());
    }

    /**
     * Fetch and display uploaded videos.
     */
    private function showUploads(Google_Client $client)
    {
        $youtube = new Google_Service_YouTube($client);
        $videos = [];
        $error = null;

        try {
            // Get the authenticated user's channel
            $channelsResponse = $youtube->channels->listChannels('contentDetails,snippet', [
                'mine' => 'true',
            ]);

            foreach ($channelsResponse['items'] as $channel) {
                $uploadsListId = $channel['contentDetails']['relatedPlaylists']['uploads'];
                $channelTitle = $channel['snippet']['title'];

                // Get videos from the uploads playlist
                $playlistItemsResponse = $youtube->playlistItems->listPlaylistItems('snippet,contentDetails', [
                    'playlistId' => $uploadsListId,
                    'maxResults' => 50,
                ]);

                foreach ($playlistItemsResponse['items'] as $item) {
                    $videos[] = [
                        'id' => $item['snippet']['resourceId']['videoId'],
                        'title' => $item['snippet']['title'],
                        'description' => $item['snippet']['description'],
                        'thumbnail' => $item['snippet']['thumbnails']['medium']['url'] ?? $item['snippet']['thumbnails']['default']['url'] ?? null,
                        'publishedAt' => $item['snippet']['publishedAt'],
                        'channelTitle' => $channelTitle,
                    ];
                }
            }
        } catch (Google_Service_Exception $e) {
            $error = 'YouTube API Error: ' . $e->getMessage();
        } catch (Google_Exception $e) {
            $error = 'Google Client Error: ' . $e->getMessage();
        }

        return view('youtube.index', [
            'videos' => $videos,
            'error' => $error ? true : false,
            'message' => $error,
            'authenticated' => true,
        ]);
    }

    /**
     * Update a YouTube video's tags (API endpoint for admin/instructors).
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateVideoTags(Request $request)
    {
        $request->validate([
            'video_id' => 'required|string',
            'tags' => 'required|array',
            'tags.*' => 'string|max:500',
        ]);

        $client = $this->getClient();
        $tokenSessionKey = 'youtube_token';

        // Check if authenticated
        if (!$request->session()->has($tokenSessionKey)) {
            return response()->json([
                'success' => false,
                'message' => 'YouTube authorization required. Please authorize first.',
                'auth_url' => route('youtube.index'),
            ], 401);
        }

        $client->setAccessToken($request->session()->get($tokenSessionKey));

        // Refresh token if expired
        if ($client->isAccessTokenExpired()) {
            if ($client->getRefreshToken()) {
                $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                $request->session()->put($tokenSessionKey, $client->getAccessToken());
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'YouTube token expired. Please re-authorize.',
                    'auth_url' => route('youtube.index'),
                ], 401);
            }
        }

        $youtube = new Google_Service_YouTube($client);
        $videoId = $request->input('video_id');
        $newTags = $request->input('tags');

        try {
            // Retrieve the video resource
            $listResponse = $youtube->videos->listVideos('snippet', [
                'id' => $videoId,
            ]);

            if (empty($listResponse['items'])) {
                return response()->json([
                    'success' => false,
                    'message' => "Video not found with ID: {$videoId}",
                ], 404);
            }

            // Get the video and its snippet
            $video = $listResponse['items'][0];
            $videoSnippet = $video['snippet'];
            $existingTags = $videoSnippet['tags'] ?? [];

            // Merge existing tags with new tags (avoid duplicates)
            $allTags = array_unique(array_merge($existingTags, $newTags));
            $videoSnippet['tags'] = array_values($allTags);

            // Update the video resource
            $video['snippet'] = $videoSnippet;
            $updateResponse = $youtube->videos->update('snippet', $video);

            return response()->json([
                'success' => true,
                'message' => 'Video tags updated successfully',
                'video' => [
                    'id' => $updateResponse['id'],
                    'title' => $updateResponse['snippet']['title'],
                    'tags' => $updateResponse['snippet']['tags'] ?? [],
                ],
            ]);

        } catch (Google_Service_Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'YouTube API Error: ' . $e->getMessage(),
            ], 500);
        } catch (Google_Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Google Client Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get details of a specific YouTube video (API endpoint for admin/instructors).
     *
     * @param Request $request
     * @param string $videoId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getVideo(Request $request, string $videoId)
    {
        $client = $this->getClient();
        $tokenSessionKey = 'youtube_token';

        if (!$request->session()->has($tokenSessionKey)) {
            return response()->json([
                'success' => false,
                'message' => 'YouTube authorization required.',
                'auth_url' => route('youtube.index'),
            ], 401);
        }

        $client->setAccessToken($request->session()->get($tokenSessionKey));

        if ($client->isAccessTokenExpired()) {
            if ($client->getRefreshToken()) {
                $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                $request->session()->put($tokenSessionKey, $client->getAccessToken());
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'YouTube token expired. Please re-authorize.',
                ], 401);
            }
        }

        $youtube = new Google_Service_YouTube($client);

        try {
            $listResponse = $youtube->videos->listVideos('snippet,contentDetails,statistics', [
                'id' => $videoId,
            ]);

            if (empty($listResponse['items'])) {
                return response()->json([
                    'success' => false,
                    'message' => "Video not found with ID: {$videoId}",
                ], 404);
            }

            $video = $listResponse['items'][0];

            return response()->json([
                'success' => true,
                'video' => [
                    'id' => $video['id'],
                    'title' => $video['snippet']['title'],
                    'description' => $video['snippet']['description'],
                    'tags' => $video['snippet']['tags'] ?? [],
                    'thumbnail' => $video['snippet']['thumbnails']['medium']['url'] ?? null,
                    'publishedAt' => $video['snippet']['publishedAt'],
                    'duration' => $video['contentDetails']['duration'] ?? null,
                    'viewCount' => $video['statistics']['viewCount'] ?? 0,
                    'likeCount' => $video['statistics']['likeCount'] ?? 0,
                ],
            ]);

        } catch (Google_Service_Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'YouTube API Error: ' . $e->getMessage(),
            ], 500);
        } catch (Google_Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Google Client Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update a YouTube video's full snippet (title, description, tags).
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateVideo(Request $request)
    {
        $request->validate([
            'video_id' => 'required|string',
            'title' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:5000',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:500',
        ]);

        $client = $this->getClient();
        $tokenSessionKey = 'youtube_token';

        if (!$request->session()->has($tokenSessionKey)) {
            return response()->json([
                'success' => false,
                'message' => 'YouTube authorization required.',
                'auth_url' => route('youtube.index'),
            ], 401);
        }

        $client->setAccessToken($request->session()->get($tokenSessionKey));

        if ($client->isAccessTokenExpired()) {
            if ($client->getRefreshToken()) {
                $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                $request->session()->put($tokenSessionKey, $client->getAccessToken());
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'YouTube token expired. Please re-authorize.',
                ], 401);
            }
        }

        $youtube = new Google_Service_YouTube($client);
        $videoId = $request->input('video_id');

        try {
            // Retrieve existing video
            $listResponse = $youtube->videos->listVideos('snippet', [
                'id' => $videoId,
            ]);

            if (empty($listResponse['items'])) {
                return response()->json([
                    'success' => false,
                    'message' => "Video not found with ID: {$videoId}",
                ], 404);
            }

            $video = $listResponse['items'][0];
            $videoSnippet = $video['snippet'];

            // Update fields if provided
            if ($request->has('title')) {
                $videoSnippet['title'] = $request->input('title');
            }
            if ($request->has('description')) {
                $videoSnippet['description'] = $request->input('description');
            }
            if ($request->has('tags')) {
                $videoSnippet['tags'] = $request->input('tags');
            }

            $video['snippet'] = $videoSnippet;
            $updateResponse = $youtube->videos->update('snippet', $video);

            return response()->json([
                'success' => true,
                'message' => 'Video updated successfully',
                'video' => [
                    'id' => $updateResponse['id'],
                    'title' => $updateResponse['snippet']['title'],
                    'description' => $updateResponse['snippet']['description'],
                    'tags' => $updateResponse['snippet']['tags'] ?? [],
                ],
            ]);

        } catch (Google_Service_Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'YouTube API Error: ' . $e->getMessage(),
            ], 500);
        } catch (Google_Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Google Client Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Check YouTube authentication status.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function checkAuth(Request $request)
    {
        $tokenSessionKey = 'youtube_token';

        if (!$request->session()->has($tokenSessionKey)) {
            return response()->json([
                'authenticated' => false,
                'auth_url' => route('youtube.index'),
            ]);
        }

        $client = $this->getClient();
        $client->setAccessToken($request->session()->get($tokenSessionKey));

        if ($client->isAccessTokenExpired()) {
            if ($client->getRefreshToken()) {
                $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                $request->session()->put($tokenSessionKey, $client->getAccessToken());
                return response()->json(['authenticated' => true]);
            }
            return response()->json([
                'authenticated' => false,
                'auth_url' => route('youtube.index'),
            ]);
        }

        return response()->json(['authenticated' => true]);
    }

    /**
     * List all uploaded videos (API endpoint).
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function listVideos(Request $request)
    {
        $client = $this->getClient();
        $tokenSessionKey = 'youtube_token';

        if (!$request->session()->has($tokenSessionKey)) {
            return response()->json([
                'success' => false,
                'message' => 'YouTube authorization required.',
                'auth_url' => route('youtube.index'),
            ], 401);
        }

        $client->setAccessToken($request->session()->get($tokenSessionKey));

        if ($client->isAccessTokenExpired()) {
            if ($client->getRefreshToken()) {
                $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                $request->session()->put($tokenSessionKey, $client->getAccessToken());
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'YouTube token expired. Please re-authorize.',
                ], 401);
            }
        }

        $youtube = new Google_Service_YouTube($client);
        $videos = [];

        try {
            $channelsResponse = $youtube->channels->listChannels('contentDetails,snippet', [
                'mine' => 'true',
            ]);

            foreach ($channelsResponse['items'] as $channel) {
                $uploadsListId = $channel['contentDetails']['relatedPlaylists']['uploads'];

                $playlistItemsResponse = $youtube->playlistItems->listPlaylistItems('snippet,contentDetails', [
                    'playlistId' => $uploadsListId,
                    'maxResults' => $request->input('limit', 50),
                ]);

                foreach ($playlistItemsResponse['items'] as $item) {
                    $videos[] = [
                        'id' => $item['snippet']['resourceId']['videoId'],
                        'title' => $item['snippet']['title'],
                        'description' => $item['snippet']['description'],
                        'thumbnail' => $item['snippet']['thumbnails']['medium']['url'] ?? null,
                        'publishedAt' => $item['snippet']['publishedAt'],
                    ];
                }
            }

            return response()->json([
                'success' => true,
                'videos' => $videos,
            ]);

        } catch (Google_Service_Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'YouTube API Error: ' . $e->getMessage(),
            ], 500);
        } catch (Google_Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Google Client Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Upload a video to YouTube.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function uploadVideo(Request $request)
    {
        $request->validate([
            'video' => 'required|file|mimetypes:video/*|max:2048000', // Max 2GB
            'title' => 'required|string|max:100',
            'description' => 'nullable|string|max:5000',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:500',
            'category_id' => 'nullable|string', // YouTube category ID
            'privacy_status' => 'nullable|in:public,private,unlisted',
        ]);

        $client = $this->getClient();
        $tokenSessionKey = 'youtube_token';

        // Check authentication
        if (!$request->session()->has($tokenSessionKey)) {
            return response()->json([
                'success' => false,
                'message' => 'YouTube authorization required. Please authorize first.',
                'auth_url' => route('youtube.index'),
            ], 401);
        }

        $client->setAccessToken($request->session()->get($tokenSessionKey));

        // Refresh token if expired
        if ($client->isAccessTokenExpired()) {
            if ($client->getRefreshToken()) {
                $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                $request->session()->put($tokenSessionKey, $client->getAccessToken());
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'YouTube token expired. Please re-authorize.',
                    'auth_url' => route('youtube.index'),
                ], 401);
            }
        }

        $youtube = new Google_Service_YouTube($client);

        try {
            // Get the uploaded file
            $videoFile = $request->file('video');
            $videoPath = $videoFile->getPathname();
            $fileSize = $videoFile->getSize();

            // Create video snippet with metadata
            $snippet = new Google_Service_YouTube_VideoSnippet();
            $snippet->setTitle($request->input('title'));
            $snippet->setDescription($request->input('description', ''));

            if ($request->has('tags')) {
                $snippet->setTags($request->input('tags'));
            }

            // Set category ID (default: 22 = People & Blogs, 27 = Education)
            $snippet->setCategoryId($request->input('category_id', '27'));

            // Set video status
            $status = new Google_Service_YouTube_VideoStatus();
            $status->privacyStatus = $request->input('privacy_status', 'unlisted');

            // Create video resource
            $video = new Google_Service_YouTube_Video();
            $video->setSnippet($snippet);
            $video->setStatus($status);

            // Set chunk size for upload (1MB chunks)
            $chunkSizeBytes = 1 * 1024 * 1024;

            // Enable deferred execution for resumable uploads
            $client->setDefer(true);

            // Create the insert request
            $insertRequest = $youtube->videos->insert('status,snippet', $video);

            // Create MediaFileUpload for resumable uploads
            $media = new Google_Http_MediaFileUpload(
                $client,
                $insertRequest,
                'video/*',
                null,
                true,
                $chunkSizeBytes
            );
            $media->setFileSize($fileSize);

            // Upload the video in chunks
            $uploadStatus = false;
            $handle = fopen($videoPath, 'rb');

            while (!$uploadStatus && !feof($handle)) {
                $chunk = fread($handle, $chunkSizeBytes);
                $uploadStatus = $media->nextChunk($chunk);
            }

            fclose($handle);

            // Reset defer mode
            $client->setDefer(false);

            if ($uploadStatus) {
                return response()->json([
                    'success' => true,
                    'message' => 'Video uploaded successfully',
                    'video' => [
                        'id' => $uploadStatus['id'],
                        'title' => $uploadStatus['snippet']['title'],
                        'description' => $uploadStatus['snippet']['description'] ?? '',
                        'url' => 'https://www.youtube.com/watch?v=' . $uploadStatus['id'],
                        'embed_url' => 'https://www.youtube.com/embed/' . $uploadStatus['id'],
                    ],
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Video upload failed. Please try again.',
            ], 500);

        } catch (Google_Service_Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'YouTube API Error: ' . $e->getMessage(),
            ], 500);
        } catch (Google_Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Google Client Error: ' . $e->getMessage(),
            ], 500);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Upload Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a video from YouTube.
     *
     * @param Request $request
     * @param string $videoId
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteVideo(Request $request, string $videoId)
    {
        $client = $this->getClient();
        $tokenSessionKey = 'youtube_token';

        if (!$request->session()->has($tokenSessionKey)) {
            return response()->json([
                'success' => false,
                'message' => 'YouTube authorization required.',
                'auth_url' => route('youtube.index'),
            ], 401);
        }

        $client->setAccessToken($request->session()->get($tokenSessionKey));

        if ($client->isAccessTokenExpired()) {
            if ($client->getRefreshToken()) {
                $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                $request->session()->put($tokenSessionKey, $client->getAccessToken());
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'YouTube token expired. Please re-authorize.',
                ], 401);
            }
        }

        $youtube = new Google_Service_YouTube($client);

        try {
            $youtube->videos->delete($videoId);

            return response()->json([
                'success' => true,
                'message' => 'Video deleted successfully',
            ]);

        } catch (Google_Service_Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'YouTube API Error: ' . $e->getMessage(),
            ], 500);
        } catch (Google_Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Google Client Error: ' . $e->getMessage(),
            ], 500);
        }
    }
}
