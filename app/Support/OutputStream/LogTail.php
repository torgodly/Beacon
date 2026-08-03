<?php

namespace App\Support\OutputStream;

/**
 * Reads a byte-offset window from a log file written by {@see FileOutputStream}.
 *
 * This backs the polling endpoint the terminal UI hits every second while a
 * deployment or command is running: the client sends back the offset it left
 * off at, and receives only the bytes written since.
 */
class LogTail
{
    /**
     * @return array{offset: int, chunk: string, eof: bool}
     */
    public static function read(string $path, int $offset = 0): array
    {
        if ($offset < 0) {
            $offset = 0;
        }

        if (! is_file($path)) {
            return ['offset' => $offset, 'chunk' => '', 'eof' => true];
        }

        $size = filesize($path);
        $size = $size === false ? 0 : $size;

        if ($offset >= $size) {
            return ['offset' => $size, 'chunk' => '', 'eof' => true];
        }

        $handle = fopen($path, 'rb');

        if ($handle === false) {
            return ['offset' => $offset, 'chunk' => '', 'eof' => true];
        }

        fseek($handle, $offset);
        $bytesToRead = max(1, $size - $offset);
        $chunk = fread($handle, $bytesToRead);
        fclose($handle);

        $newOffset = $offset + strlen($chunk === false ? '' : $chunk);

        return [
            'offset' => $newOffset,
            'chunk' => $chunk === false ? '' : $chunk,
            'eof' => $newOffset >= $size,
        ];
    }
}
