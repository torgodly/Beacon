<?php

namespace Tests\Unit\Services\Database;

use App\Services\Database\DatabaseNaming;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DatabaseNamingTest extends TestCase
{
    #[DataProvider('databaseNames')]
    public function test_database_from_site(string $siteName, string $expected): void
    {
        $this->assertSame($expected, DatabaseNaming::databaseFromSite($siteName));
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function databaseNames(): array
    {
        return [
            'domain' => ['app.example.com', 'app_example_com'],
            'hyphenated' => ['my-app.test', 'my_app_test'],
            'empty fallback' => ['...', 'site'],
        ];
    }
}
