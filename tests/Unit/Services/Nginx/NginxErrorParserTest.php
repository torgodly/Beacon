<?php

namespace Tests\Unit\Services\Nginx;

use App\Services\Nginx\NginxErrorParser;
use PHPUnit\Framework\TestCase;

class NginxErrorParserTest extends TestCase
{
    public function test_parses_emerg_line_number_and_directive(): void
    {
        $output = '[emerg] unknown directive "foo_bar" in /tmp/nginx.conf:42';

        $parsed = NginxErrorParser::humanize($output);

        $this->assertSame(42, $parsed['line']);
        $this->assertSame('foo_bar', $parsed['directive']);
        $this->assertSame('unknown directive "foo_bar"', $parsed['message']);
    }

    public function test_returns_fallback_when_output_is_unrecognized(): void
    {
        $parsed = NginxErrorParser::humanize('');

        $this->assertNull($parsed['line']);
        $this->assertNull($parsed['directive']);
        $this->assertSame('Nginx rejected the configuration.', $parsed['message']);
    }
}
