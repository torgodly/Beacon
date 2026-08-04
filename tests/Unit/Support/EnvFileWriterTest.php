<?php

namespace Tests\Unit\Support;

use App\Support\EnvFileWriter;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class EnvFileWriterTest extends TestCase
{
    #[DataProvider('formatValueProvider')]
    public function test_format_value_quotes_special_characters(string $value, string $expected): void
    {
        $this->assertSame($expected, EnvFileWriter::formatValue($value));
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function formatValueProvider(): array
    {
        return [
            'empty' => ['', '""'],
            'simple' => ['production', 'production'],
            'host' => ['127.0.0.1', '127.0.0.1'],
            'hash comment char' => ['pa#ss', '"pa#ss"'],
            'dollar sign' => ['pa$ss', '"pa\$ss"'],
            'spaces' => ['hello world', '"hello world"'],
            'quotes' => ['pa"ss', '"pa\"ss"'],
        ];
    }

    public function test_set_replaces_existing_key_and_quotes_password(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'beacon-env-');
        $this->assertNotFalse($path);

        file_put_contents($path, "DB_PASSWORD=broken\nAPP_ENV=local\n");

        EnvFileWriter::set($path, 'DB_PASSWORD', 'secr#et$word');

        $contents = file_get_contents($path);

        $this->assertSame("DB_PASSWORD=\"secr#et\\\$word\"\nAPP_ENV=local\n", $contents);

        @unlink($path);
    }
}
