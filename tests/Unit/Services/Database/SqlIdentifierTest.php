<?php

namespace Tests\Unit\Services\Database;

use App\Services\Database\SqlIdentifier;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class SqlIdentifierTest extends TestCase
{
    public function test_quotes_valid_identifiers(): void
    {
        $this->assertSame('`app_production`', SqlIdentifier::quote('app_production'));
    }

    public function test_rejects_invalid_identifiers(): void
    {
        $this->expectException(InvalidArgumentException::class);

        SqlIdentifier::quote('app-production');
    }

    public function test_quotes_user_and_host_literals(): void
    {
        $this->assertSame("'app_user'", SqlIdentifier::quoteUser('app_user'));
        $this->assertSame("'localhost'", SqlIdentifier::quoteHost('localhost'));
    }
}
