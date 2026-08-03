<?php

namespace Tests\Unit\Services\Supervisor;

use App\Services\Supervisor\SupervisorStatusParser;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SupervisorStatusParserTest extends TestCase
{
    #[Test]
    public function it_parses_running_status(): void
    {
        $parser = new SupervisorStatusParser;

        $parsed = $parser->parseLine('example-com-queue RUNNING pid 123, uptime 0:01:00');

        $this->assertSame('running', $parsed['status']);
    }

    #[Test]
    public function it_parses_stopped_status(): void
    {
        $parser = new SupervisorStatusParser;

        $parsed = $parser->parseLine('example-com-queue STOPPED');

        $this->assertSame('stopped', $parsed['status']);
    }
}
