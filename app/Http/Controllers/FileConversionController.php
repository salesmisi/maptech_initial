<?php

namespace App\Http\Controllers;

use App\Services\FileConversionService;
use App\Models\Module;
use App\Models\Lesson;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Exception;

class FileConversionController extends Controller
{
    protected FileConversionService $conversionService;

    public function __construct(FileConversionService $conversionService)
    {
        $this->conversionService = $conversionService;
    }

    /**
     * Check if LibreOffice is available for conversions.
     */
    public function checkAvailability()
    {
        return response()->json([
            'libreoffice_available' => $this->conversionService->isLibreOfficeAvailable(),
            'supported_conversions' => $this->conversionService->getSupportedConversions(),
        ]);
    }

    /**
     * Convert a PDF file to PPTX.
     * Accepts a file upload or a path to an existing file in storage.
     */
    public function convertPdfToPptx(Request $request)
    {
        $request->validate([
            'file' => 'required_without:storage_path|file|mimes:pdf|max:102400', // 100MB max
            'storage_path' => 'required_without:file|string',
        ]);

        try {
            if ($request->hasFile('file')) {
                // Handle uploaded file
                $file = $request->file('file');
                $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);

                // Ensure temp directory exists
                $tempDir = storage_path('app/temp/conversions');
                if (!is_dir($tempDir)) {
                    mkdir($tempDir, 0755, true);
                }

                // Store the uploaded file temporarily
                $tempFileName = Str::uuid() . '.pdf';
                $tempPath = 'temp/conversions/' . $tempFileName;
                $fullTempPath = storage_path('app/' . $tempPath);

                // Move uploaded file directly to temp location
                $file->move($tempDir, $tempFileName);

                Log::info('PDF conversion: file saved', [
                    'temp_path' => $fullTempPath,
                    'exists' => file_exists($fullTempPath),
                ]);

                if (!file_exists($fullTempPath)) {
                    return response()->json([
                        'success' => false,
                        'error' => 'Failed to save uploaded file.',
                    ], 500);
                }

                // Perform conversion
                $result = $this->conversionService->pdfToPptx($fullTempPath);

                // Clean up temp input file
                @unlink($fullTempPath);

                if (!$result['success']) {
                    return response()->json([
                        'success' => false,
                        'error' => $result['error'],
                    ], 422);
                }

                // Move converted file to public storage
                $outputFileName = $originalName . '.pptx';
                $publicPath = 'conversions/' . Str::uuid() . '/' . $outputFileName;

                Storage::disk('public')->put($publicPath, file_get_contents($result['output_path']));

                // Clean up temp output
                @unlink($result['output_path']);

                return response()->json([
                    'success' => true,
                    'file_name' => $outputFileName,
                    'file_url' => asset('storage/' . $publicPath),
                    'storage_path' => 'public/' . $publicPath,
                ]);
            } else {
                // Convert existing file in storage
                $storagePath = $request->input('storage_path');

                // Handle public storage paths
                if (Str::startsWith($storagePath, 'public/')) {
                    $storagePath = Str::after($storagePath, 'public/');
                    $fullPath = storage_path('app/public/' . $storagePath);
                } else {
                    $fullPath = storage_path('app/' . $storagePath);
                }

                if (!file_exists($fullPath)) {
                    return response()->json([
                        'success' => false,
                        'error' => 'File not found at specified path.',
                    ], 404);
                }

                $result = $this->conversionService->pdfToPptx($fullPath);

                if (!$result['success']) {
                    return response()->json([
                        'success' => false,
                        'error' => $result['error'],
                    ], 422);
                }

                $originalName = pathinfo($fullPath, PATHINFO_FILENAME);
                $outputFileName = $originalName . '.pptx';
                $publicPath = 'conversions/' . Str::uuid() . '/' . $outputFileName;

                Storage::disk('public')->put($publicPath, file_get_contents($result['output_path']));

                // Clean up temp output
                @unlink($result['output_path']);

                return response()->json([
                    'success' => true,
                    'file_name' => $outputFileName,
                    'file_url' => asset('storage/' . $publicPath),
                    'storage_path' => 'public/' . $publicPath,
                ]);
            }
        } catch (Exception $e) {
            Log::error('PDF to PPTX conversion failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'An error occurred during conversion: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Convert a lesson's PDF content to PPTX.
     * This updates the lesson to use the new PPTX file.
     */
    public function convertLessonPdfToPptx(Request $request, int $lessonId)
    {
        $lesson = Lesson::findOrFail($lessonId);

        if (!$lesson->content_path) {
            return response()->json([
                'success' => false,
                'error' => 'Lesson has no content file attached.',
            ], 422);
        }

        // Check if it's a PDF
        $extension = strtolower(pathinfo($lesson->content_path, PATHINFO_EXTENSION));
        if ($extension !== 'pdf') {
            return response()->json([
                'success' => false,
                'error' => 'Lesson content is not a PDF file.',
            ], 422);
        }

        try {
            // Get full path to PDF
            if (Str::startsWith($lesson->content_path, 'http')) {
                return response()->json([
                    'success' => false,
                    'error' => 'Cannot convert external URL files. Please upload the PDF first.',
                ], 422);
            }

            $fullPath = storage_path('app/public/' . $lesson->content_path);
            if (!file_exists($fullPath)) {
                // Try without public prefix
                $fullPath = storage_path('app/' . $lesson->content_path);
            }

            if (!file_exists($fullPath)) {
                return response()->json([
                    'success' => false,
                    'error' => 'PDF file not found on server.',
                ], 404);
            }

            // Convert
            $result = $this->conversionService->pdfToPptx($fullPath);

            if (!$result['success']) {
                return response()->json([
                    'success' => false,
                    'error' => $result['error'],
                ], 422);
            }

            // Move to lesson storage location
            $directory = pathinfo($lesson->content_path, PATHINFO_DIRNAME);
            $newFileName = pathinfo($lesson->content_path, PATHINFO_FILENAME) . '.pptx';
            $newPath = $directory . '/' . $newFileName;

            // Copy converted file to storage
            Storage::disk('public')->put($newPath, file_get_contents($result['output_path']));

            // Clean up temp output
            @unlink($result['output_path']);

            // Update lesson
            $keepPdf = $request->boolean('keep_pdf', false);
            if (!$keepPdf) {
                // Delete original PDF
                Storage::disk('public')->delete($lesson->content_path);
            }

            $lesson->update([
                'content_path' => $newPath,
                'file_name' => $newFileName,
            ]);

            return response()->json([
                'success' => true,
                'lesson' => $lesson->fresh(),
                'message' => 'Lesson PDF converted to PowerPoint successfully.',
            ]);
        } catch (Exception $e) {
            Log::error('Lesson PDF to PPTX conversion failed', [
                'lesson_id' => $lessonId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Conversion failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Convert a module's PDF content to PPTX.
     */
    public function convertModulePdfToPptx(Request $request, int $moduleId)
    {
        $module = Module::findOrFail($moduleId);

        if (!$module->content_path) {
            return response()->json([
                'success' => false,
                'error' => 'Module has no content file attached.',
            ], 422);
        }

        // Check if it's a PDF
        $extension = strtolower(pathinfo($module->content_path, PATHINFO_EXTENSION));
        if ($extension !== 'pdf') {
            return response()->json([
                'success' => false,
                'error' => 'Module content is not a PDF file.',
            ], 422);
        }

        try {
            if (Str::startsWith($module->content_path, 'http')) {
                return response()->json([
                    'success' => false,
                    'error' => 'Cannot convert external URL files. Please upload the PDF first.',
                ], 422);
            }

            $fullPath = storage_path('app/public/' . $module->content_path);
            if (!file_exists($fullPath)) {
                $fullPath = storage_path('app/' . $module->content_path);
            }

            if (!file_exists($fullPath)) {
                return response()->json([
                    'success' => false,
                    'error' => 'PDF file not found on server.',
                ], 404);
            }

            // Convert
            $result = $this->conversionService->pdfToPptx($fullPath);

            if (!$result['success']) {
                return response()->json([
                    'success' => false,
                    'error' => $result['error'],
                ], 422);
            }

            // Move to module storage location
            $directory = pathinfo($module->content_path, PATHINFO_DIRNAME);
            $newFileName = pathinfo($module->content_path, PATHINFO_FILENAME) . '.pptx';
            $newPath = $directory . '/' . $newFileName;

            Storage::disk('public')->put($newPath, file_get_contents($result['output_path']));

            // Clean up temp output
            @unlink($result['output_path']);

            // Update module
            $keepPdf = $request->boolean('keep_pdf', false);
            if (!$keepPdf) {
                Storage::disk('public')->delete($module->content_path);
            }

            $module->update([
                'content_path' => $newPath,
            ]);

            return response()->json([
                'success' => true,
                'module' => $module->fresh(),
                'message' => 'Module PDF converted to PowerPoint successfully.',
            ]);
        } catch (Exception $e) {
            Log::error('Module PDF to PPTX conversion failed', [
                'module_id' => $moduleId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Conversion failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Convert PPTX file to PDF for viewing.
     * Checks if a converted PDF already exists, if not converts it.
     * Returns the URL to the PDF file.
     */
    public function convertPptxToPdf(Request $request)
    {
        $request->validate([
            'file' => 'required_without:storage_path|file|mimes:pptx,ppt|max:102400',
            'storage_path' => 'required_without:file|string',
        ]);

        try {
            if ($request->hasFile('file')) {
                // Handle uploaded file
                $file = $request->file('file');
                $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);

                // Ensure temp directory exists
                $tempDir = storage_path('app/temp/conversions');
                if (!is_dir($tempDir)) {
                    mkdir($tempDir, 0755, true);
                }

                // Store temporarily
                $tempFileName = Str::uuid() . '.pptx';
                $fullTempPath = $tempDir . DIRECTORY_SEPARATOR . $tempFileName;
                $file->move($tempDir, $tempFileName);

                // Convert
                $result = $this->conversionService->pptxToPdf($fullTempPath);

                // Clean up temp input
                @unlink($fullTempPath);

                if (!$result['success']) {
                    return response()->json([
                        'success' => false,
                        'error' => $result['error'],
                    ], 422);
                }

                // Move to public storage
                $outputFileName = $originalName . '.pdf';
                $publicPath = 'conversions/' . Str::uuid() . '/' . $outputFileName;

                Storage::disk('public')->put($publicPath, file_get_contents($result['output_path']));
                @unlink($result['output_path']);

                return response()->json([
                    'success' => true,
                    'file_name' => $outputFileName,
                    'file_url' => asset('storage/' . $publicPath),
                    'storage_path' => 'public/' . $publicPath,
                ]);
            } else {
                // Convert existing file in storage
                $storagePath = $request->input('storage_path');

                // Resolve full path
                if (Str::startsWith($storagePath, 'public/')) {
                    $storagePath = Str::after($storagePath, 'public/');
                    $fullPath = storage_path('app/public/' . $storagePath);
                } elseif (Str::startsWith($storagePath, '/storage/')) {
                    $storagePath = Str::after($storagePath, '/storage/');
                    $fullPath = storage_path('app/public/' . $storagePath);
                } else {
                    $fullPath = storage_path('app/public/' . $storagePath);
                }

                if (!file_exists($fullPath)) {
                    // Try app storage
                    $fullPath = storage_path('app/' . $storagePath);
                }

                if (!file_exists($fullPath)) {
                    return response()->json([
                        'success' => false,
                        'error' => 'File not found at specified path.',
                    ], 404);
                }

                // Check if PDF version already exists
                $pdfPath = pathinfo($fullPath, PATHINFO_DIRNAME) . DIRECTORY_SEPARATOR .
                           pathinfo($fullPath, PATHINFO_FILENAME) . '.pdf';

                if (file_exists($pdfPath)) {
                    // Return existing PDF
                    $relativePath = str_replace(storage_path('app/public/'), '', $pdfPath);
                    return response()->json([
                        'success' => true,
                        'file_name' => basename($pdfPath),
                        'file_url' => asset('storage/' . $relativePath),
                        'storage_path' => 'public/' . $relativePath,
                        'cached' => true,
                    ]);
                }

                // Convert
                $result = $this->conversionService->pptxToPdf($fullPath, $pdfPath);

                if (!$result['success']) {
                    return response()->json([
                        'success' => false,
                        'error' => $result['error'],
                    ], 422);
                }

                $relativePath = str_replace(storage_path('app/public/'), '', $result['output_path']);

                return response()->json([
                    'success' => true,
                    'file_name' => basename($result['output_path']),
                    'file_url' => asset('storage/' . $relativePath),
                    'storage_path' => 'public/' . $relativePath,
                ]);
            }
        } catch (Exception $e) {
            Log::error('PPTX to PDF conversion failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Conversion failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get PDF version of a PPTX file URL.
     * Converts if needed, returns cached version if exists.
     */
    public function getPptxAsPdf(Request $request)
    {
        $request->validate([
            'url' => 'required|string',
        ]);

        $url = $request->input('url');

        try {
            // Parse URL to get storage path
            $path = parse_url($url, PHP_URL_PATH);

            // Remove /storage/ prefix if present
            if (Str::startsWith($path, '/storage/')) {
                $storagePath = Str::after($path, '/storage/');
            } else {
                $storagePath = ltrim($path, '/');
            }

            $fullPath = storage_path('app/public/' . $storagePath);

            if (!file_exists($fullPath)) {
                return response()->json([
                    'success' => false,
                    'error' => 'Original PPTX file not found.',
                ], 404);
            }

            // Check if PDF exists
            $pdfPath = pathinfo($fullPath, PATHINFO_DIRNAME) . DIRECTORY_SEPARATOR .
                       pathinfo($fullPath, PATHINFO_FILENAME) . '.pdf';

            if (!file_exists($pdfPath)) {
                // Convert
                $result = $this->conversionService->pptxToPdf($fullPath, $pdfPath);

                if (!$result['success']) {
                    return response()->json([
                        'success' => false,
                        'error' => $result['error'],
                    ], 422);
                }
            }

            $relativePath = str_replace(storage_path('app/public/'), '', $pdfPath);

            return response()->json([
                'success' => true,
                'pdf_url' => asset('storage/' . $relativePath),
            ]);
        } catch (Exception $e) {
            Log::error('Get PPTX as PDF failed', [
                'url' => $url,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to get PDF version: ' . $e->getMessage(),
            ], 500);
        }
    }
}
