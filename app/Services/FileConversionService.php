<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class FileConversionService
{
    /**
     * Path to LibreOffice executable.
     * Adjust this based on your system.
     */
    protected string $libreOfficePath;

    /**
     * Temporary directory for conversions.
     */
    protected string $tempDir;

    public function __construct()
    {
        // LibreOffice paths by OS
        $this->libreOfficePath = $this->detectLibreOfficePath();
        $this->tempDir = storage_path('app/conversions');

        // Ensure temp directory exists
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0755, true);
        }
    }

    /**
     * Detect LibreOffice installation path.
     */
    protected function detectLibreOfficePath(): string
    {
        // Check for custom path in config
        $customPath = config('services.libreoffice.path');
        if ($customPath && file_exists($customPath)) {
            return $customPath;
        }

        // Common paths by OS
        if (PHP_OS_FAMILY === 'Windows') {
            // Use soffice.com (console variant) on Windows - always runs headless and captures output properly
            $paths = [
                'C:\\Program Files\\LibreOffice\\program\\soffice.com',
                'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com',
                'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
                'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
            ];
        } elseif (PHP_OS_FAMILY === 'Darwin') { // macOS
            $paths = [
                '/Applications/LibreOffice.app/Contents/MacOS/soffice',
            ];
        } else { // Linux
            $paths = [
                '/usr/bin/soffice',
                '/usr/bin/libreoffice',
                '/usr/local/bin/soffice',
            ];
        }

        foreach ($paths as $path) {
            if (file_exists($path)) {
                return $path;
            }
        }

        // Fallback - assume it's in PATH
        return PHP_OS_FAMILY === 'Windows' ? 'soffice.exe' : 'soffice';
    }

    /**
     * Check if LibreOffice is available.
     */
    public function isLibreOfficeAvailable(): bool
    {
        // First check if LibreOffice executable exists
        if (file_exists($this->libreOfficePath)) {
            return true;
        }

        $command = PHP_OS_FAMILY === 'Windows'
            ? 'where soffice.exe 2>nul'
            : 'which soffice 2>/dev/null';

        exec($command, $output, $returnCode);

        return $returnCode === 0;
    }

    /**
     * Kill any running LibreOffice processes (Windows-specific fix).
     */
    protected function killRunningLibreOfficeProcesses(): void
    {
        if (PHP_OS_FAMILY === 'Windows') {
            // Kill any running soffice processes that might block headless conversion
            exec('taskkill /F /IM soffice.exe /T 2>nul', $output, $returnCode);
            exec('taskkill /F /IM soffice.bin /T 2>nul', $output, $returnCode);
            // Small delay to ensure processes are terminated
            usleep(500000); // 0.5 seconds
        }
    }

    /**
     * Convert PDF to PPTX.
     *
     * @param string $inputPath Full path to the input PDF file
     * @param string|null $outputPath Optional output path (defaults to same directory with .pptx extension)
     * @return array{success: bool, output_path?: string, error?: string}
     */
    public function pdfToPptx(string $inputPath, ?string $outputPath = null): array
    {
        if (!file_exists($inputPath)) {
            return [
                'success' => false,
                'error' => 'Input file does not exist.',
            ];
        }

        if (!$this->isLibreOfficeAvailable()) {
            return [
                'success' => false,
                'error' => 'LibreOffice is not installed or not accessible. Please install LibreOffice to enable PDF to PPTX conversion.',
            ];
        }

        // Generate unique temp directory for this conversion
        $tempId = Str::uuid();
        $workDir = $this->tempDir . DIRECTORY_SEPARATOR . $tempId;

        if (!mkdir($workDir, 0755, true)) {
            return [
                'success' => false,
                'error' => 'Failed to create temporary directory.',
            ];
        }

        try {
            // Copy input file to temp directory
            $inputBasename = basename($inputPath);
            $tempInputPath = $workDir . DIRECTORY_SEPARATOR . $inputBasename;
            copy($inputPath, $tempInputPath);

            // Build LibreOffice command
            // --headless: Run without GUI
            // --convert-to: Output format
            // --outdir: Output directory
            $escapedPath = escapeshellarg($tempInputPath);
            $escapedWorkDir = escapeshellarg($workDir);
            $escapedSoffice = escapeshellarg($this->libreOfficePath);

            $command = sprintf(
                '%s --headless --convert-to pptx --outdir %s %s 2>&1',
                $escapedSoffice,
                $escapedWorkDir,
                $escapedPath
            );

            Log::info('Running conversion command', ['command' => $command]);

            exec($command, $output, $returnCode);

            Log::info('Conversion command output', [
                'output' => implode("\n", $output),
                'returnCode' => $returnCode,
            ]);

            // Find the output file
            $expectedOutputName = pathinfo($inputBasename, PATHINFO_FILENAME) . '.pptx';
            $tempOutputPath = $workDir . DIRECTORY_SEPARATOR . $expectedOutputName;

            if (!file_exists($tempOutputPath)) {
                // Clean up
                $this->cleanupDirectory($workDir);

                return [
                    'success' => false,
                    'error' => 'Conversion failed. LibreOffice did not produce output file. Output: ' . implode("\n", $output),
                ];
            }

            // Determine final output path
            if (!$outputPath) {
                $outputPath = pathinfo($inputPath, PATHINFO_DIRNAME) . DIRECTORY_SEPARATOR .
                              pathinfo($inputPath, PATHINFO_FILENAME) . '.pptx';
            }

            // Move output file to final destination
            if (!copy($tempOutputPath, $outputPath)) {
                $this->cleanupDirectory($workDir);

                return [
                    'success' => false,
                    'error' => 'Failed to move converted file to destination.',
                ];
            }

            // Clean up temp directory
            $this->cleanupDirectory($workDir);

            return [
                'success' => true,
                'output_path' => $outputPath,
            ];
        } catch (\Exception $e) {
            Log::error('PDF to PPTX conversion failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Clean up on error
            if (is_dir($workDir)) {
                $this->cleanupDirectory($workDir);
            }

            return [
                'success' => false,
                'error' => 'Conversion failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Convert a stored file (in storage/app).
     *
     * @param string $storagePath Path relative to storage/app
     * @return array{success: bool, output_path?: string, storage_path?: string, error?: string}
     */
    public function convertStoredPdfToPptx(string $storagePath): array
    {
        $fullPath = storage_path('app/' . $storagePath);

        if (!file_exists($fullPath)) {
            return [
                'success' => false,
                'error' => 'Stored file not found.',
            ];
        }

        $outputPath = pathinfo($fullPath, PATHINFO_DIRNAME) . DIRECTORY_SEPARATOR .
                      pathinfo($fullPath, PATHINFO_FILENAME) . '.pptx';

        $result = $this->pdfToPptx($fullPath, $outputPath);

        if ($result['success']) {
            // Add storage-relative path
            $result['storage_path'] = str_replace(
                storage_path('app/'),
                '',
                $result['output_path']
            );
        }

        return $result;
    }

    /**
     * Clean up a directory and its contents.
     */
    protected function cleanupDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $files = array_diff(scandir($dir), ['.', '..']);

        foreach ($files as $file) {
            $path = $dir . DIRECTORY_SEPARATOR . $file;
            if (is_dir($path)) {
                $this->cleanupDirectory($path);
            } else {
                unlink($path);
            }
        }

        rmdir($dir);
    }

    /**
     * Convert PPTX to PDF.
     *
     * @param string $inputPath Full path to the input PPTX file
     * @param string|null $outputPath Optional output path (defaults to same directory with .pdf extension)
     * @return array{success: bool, output_path?: string, error?: string}
     */
    public function pptxToPdf(string $inputPath, ?string $outputPath = null): array
    {
        if (!file_exists($inputPath)) {
            return [
                'success' => false,
                'error' => 'Input file does not exist.',
            ];
        }

        if (!$this->isLibreOfficeAvailable()) {
            return [
                'success' => false,
                'error' => 'LibreOffice is not installed or not accessible.',
            ];
        }

        // Generate unique temp directory for this conversion
        $tempId = Str::uuid();
        $workDir = $this->tempDir . DIRECTORY_SEPARATOR . $tempId;

        if (!mkdir($workDir, 0755, true)) {
            return [
                'success' => false,
                'error' => 'Failed to create temporary directory.',
            ];
        }

        try {
            // Copy input file to temp directory
            $inputBasename = basename($inputPath);
            $tempInputPath = $workDir . DIRECTORY_SEPARATOR . $inputBasename;
            copy($inputPath, $tempInputPath);

            // Build LibreOffice command for PDF conversion
            // On Windows: soffice.com is the console variant that always runs headless
            // On Linux/Mac: use standard soffice with --headless flag
            $command = sprintf(
                '"%s" --headless --convert-to pdf --outdir "%s" "%s" 2>&1',
                $this->libreOfficePath,
                $workDir,
                $tempInputPath
            );

            Log::info('Running PPTX to PDF conversion', ['command' => $command]);

            exec($command, $outputLines, $returnCode);
            $stdout = implode("\n", $outputLines ?? []);
            $stderr = '';

            Log::info('PPTX to PDF conversion output', [
                'stdout' => $stdout,
                'stderr' => $stderr,
                'returnCode' => $returnCode,
            ]);

            // Find the output file
            $expectedOutputName = pathinfo($inputBasename, PATHINFO_FILENAME) . '.pdf';
            $tempOutputPath = $workDir . DIRECTORY_SEPARATOR . $expectedOutputName;

            // Wait a bit for file system to catch up (Windows can be slow)
            if (PHP_OS_FAMILY === 'Windows' && !file_exists($tempOutputPath)) {
                usleep(500000); // 0.5 seconds
            }

            if (!file_exists($tempOutputPath)) {
                $this->cleanupDirectory($workDir);

                Log::error('Conversion failed - no output file', [
                    'expected' => $tempOutputPath,
                    'stdout' => $stdout,
                    'returnCode' => $returnCode,
                ]);

                return [
                    'success' => false,
                    'error' => 'Conversion failed. LibreOffice did not produce output file. Output: ' . $stdout . ' ' . $stderr,
                ];
            }

            // Determine final output path
            if (!$outputPath) {
                $outputPath = pathinfo($inputPath, PATHINFO_DIRNAME) . DIRECTORY_SEPARATOR .
                              pathinfo($inputPath, PATHINFO_FILENAME) . '.pdf';
            }

            // Move output file to final destination
            if (!copy($tempOutputPath, $outputPath)) {
                $this->cleanupDirectory($workDir);

                return [
                    'success' => false,
                    'error' => 'Failed to move converted file to destination.',
                ];
            }

            // Clean up temp directory
            $this->cleanupDirectory($workDir);

            return [
                'success' => true,
                'output_path' => $outputPath,
            ];
        } catch (\Exception $e) {
            Log::error('PPTX to PDF conversion failed', [
                'error' => $e->getMessage(),
            ]);

            if (is_dir($workDir)) {
                $this->cleanupDirectory($workDir);
            }

            return [
                'success' => false,
                'error' => 'Conversion failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Get supported conversions info.
     */
    public function getSupportedConversions(): array
    {
        return [
            'pdf_to_pptx' => [
                'name' => 'PDF to PowerPoint',
                'from' => ['pdf'],
                'to' => 'pptx',
                'available' => $this->isLibreOfficeAvailable(),
            ],
            'pptx_to_pdf' => [
                'name' => 'PowerPoint to PDF',
                'from' => ['pptx', 'ppt'],
                'to' => 'pdf',
                'available' => $this->isLibreOfficeAvailable(),
            ],
        ];
    }
}
