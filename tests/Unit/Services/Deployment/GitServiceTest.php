<?php

namespace Tests\Unit\Services\Deployment;

use App\Contracts\OutputStream;
use App\Models\Site;
use App\Services\Deployment\GitService;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class GitServiceTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_sync_working_tree_initializes_repository_in_existing_site_directory(): void
    {
        $this->processFactory->willReturnSequence([
            1, // not a git repository yet
            0, // git init
            1, // remote get-url (missing)
            0, // remote add
            0, // fetch
            0, // reset
        ]);

        $site = Site::factory()->laravel()->create([
            'repository' => 'https://github.com/torgodly/sky-restaurant.git',
            'repository_branch' => 'master',
            'path' => '/home/beacon/sky-restaurant',
        ]);

        $stream = $this->outputStream();

        app(GitService::class)->syncWorkingTree($site, $stream);

        $this->assertSame(
            [
                ['/usr/bin/test', '-d', '.git'],
                ['/usr/bin/git', 'init'],
                ['/usr/bin/git', 'remote', 'get-url', 'origin'],
                ['/usr/bin/git', 'remote', 'add', 'origin', 'https://github.com/torgodly/sky-restaurant.git'],
                ['/usr/bin/git', 'fetch', 'origin', 'master', '--depth', '1'],
                ['/usr/bin/git', 'reset', '--hard', 'origin/master'],
            ],
            collect($this->siteJobs())->pluck('argv')->all(),
        );
        $this->assertStringContainsString('Initializing', $stream->buffer);
        $this->assertFalse(
            collect($this->siteJobs())->contains(
                fn (array $job): bool => ($job['argv'][1] ?? null) === 'clone',
            ),
        );
    }

    public function test_sync_working_tree_fetches_when_git_repository_already_exists(): void
    {
        $this->processFactory->willReturnSequence([
            0, // is a git repository
            0, // fetch
            0, // reset
        ]);

        $site = Site::factory()->laravel()->create([
            'repository' => 'https://github.com/example/app.git',
            'repository_branch' => 'main',
            'path' => '/home/beacon/app',
        ]);

        $stream = $this->outputStream();

        app(GitService::class)->syncWorkingTree($site, $stream);

        $this->assertSame(
            [
                ['/usr/bin/test', '-d', '.git'],
                ['/usr/bin/git', 'fetch', 'origin', 'main'],
                ['/usr/bin/git', 'reset', '--hard', 'origin/main'],
            ],
            collect($this->siteJobs())->pluck('argv')->all(),
        );
        $this->assertStringContainsString('Fetching latest from origin/main', $stream->buffer);
    }

    public function test_sync_working_tree_updates_existing_remote_origin(): void
    {
        $this->processFactory->willReturnSequence([
            1, // not a git repository yet
            0, // git init
            0, // remote get-url
            0, // remote set-url
            0, // fetch
            0, // reset
        ]);

        $site = Site::factory()->laravel()->create([
            'repository' => 'https://github.com/example/new-repo.git',
            'repository_branch' => 'main',
            'path' => '/home/beacon/app',
        ]);

        app(GitService::class)->syncWorkingTree($site, $this->outputStream());

        $this->assertTrue(
            collect($this->siteJobs())->contains(
                fn (array $job): bool => $job['argv'] === [
                    '/usr/bin/git', 'remote', 'set-url', 'origin', 'https://github.com/example/new-repo.git',
                ],
            ),
        );
    }

    /**
     * @return list<array{cwd: string, argv: list<string>}>
     */
    private function siteJobs(): array
    {
        $jobs = [];

        foreach ($this->processFactory->calls as $call) {
            if (! in_array('/opt/beacon/bin/beacon-run', $call['command'], true)) {
                continue;
            }

            $spec = json_decode((string) $call['input'], true);

            if (is_array($spec) && isset($spec['argv'], $spec['cwd'])) {
                $jobs[] = $spec;
            }
        }

        return $jobs;
    }

    private function outputStream(): OutputStream
    {
        return new class implements OutputStream
        {
            public string $buffer = '';

            public function append(string $chunk): void
            {
                $this->buffer .= $chunk;
            }

            public function close(): void {}
        };
    }
}
