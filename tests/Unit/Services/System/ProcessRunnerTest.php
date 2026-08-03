<?php

namespace Tests\Unit\Services\System;

use App\Contracts\OutputStream;
use App\Services\System\ProcessFactory;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class ProcessRunnerTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $factory;

    private ProcessRunner $runner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->factory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->factory);
        $this->runner = $this->app->make(ProcessRunner::class);
    }

    public function test_run_executes_as_panel_with_base_environment(): void
    {
        $this->factory->willReturn(0, 'ok');

        $result = $this->runner->run(['echo', 'hello']);

        $this->assertTrue($result->successful());
        $this->assertSame('ok', $result->output());

        $call = $this->factory->lastCall();
        $this->assertSame(['echo', 'hello'], $call['command']);
        $this->assertSame('/home/beacon-panel', $call['env']['HOME']);
        $this->assertSame('beacon-panel', $call['env']['USER']);
    }

    public function test_sudo_root_invokes_wrapper_with_stdin_on_argv(): void
    {
        $this->factory->willReturn(0, 'written');

        $result = $this->runner->sudoRoot(
            SudoWrapper::Nginx,
            ['write', 'example.com'],
            stdin: "server { listen 80; }\n",
        );

        $this->assertTrue($result->successful());

        $call = $this->factory->lastCall();
        $this->assertSame(
            ['sudo', '-n', SudoWrapper::Nginx->path(), 'write', 'example.com'],
            $call['command'],
        );
        $this->assertSame("server { listen 80; }\n", $call['input']);
    }

    public function test_as_site_sends_json_job_spec_to_beacon_run(): void
    {
        $this->factory->willReturn(0, 'deployed');

        $result = $this->runner->asSite(
            argv: ['/bin/bash', '-lc', 'echo hi'],
            cwd: '/home/beacon/example.com',
            env: ['BEACON_SITE' => 'example.com'],
            oomExpendable: true,
        );

        $this->assertTrue($result->successful());

        $call = $this->factory->lastCall();
        $this->assertSame(
            ['sudo', '-n', '-u', 'beacon', SudoWrapper::Run->path()],
            $call['command'],
        );

        $payload = json_decode((string) $call['input'], true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame('/home/beacon/example.com', $payload['cwd']);
        $this->assertSame(['/bin/bash', '-lc', 'echo hi'], $payload['argv']);
        $this->assertSame(['BEACON_SITE' => 'example.com'], $payload['env']);
        $this->assertTrue($payload['oom_expendable']);
    }

    public function test_run_streams_output_through_output_stream(): void
    {
        $this->factory->willReturn(0, 'chunk');

        $stream = new class implements OutputStream
        {
            public string $buffer = '';

            public function append(string $chunk): void
            {
                $this->buffer .= $chunk;
            }

            public function close(): void {}
        };

        $this->runner->run(['echo'], stream: $stream);

        $this->assertSame('chunk', $stream->buffer);
    }
}
