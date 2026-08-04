<?php

namespace Tests\Unit\Services\Deployment;

use App\Contracts\OutputStream;
use App\Exceptions\DeploymentFailedException;
use App\Models\Site;
use App\Services\Deployment\DeployPreflight;
use App\Services\Deployment\DeployScriptFactory;
use App\Services\Nginx\NginxService;
use App\Services\System\SiteFilesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class DeployPreflightTest extends TestCase
{
    use RefreshDatabase;

    public function test_static_plain_html_site_gets_root_document_directory(): void
    {
        $site = Site::factory()->create([
            'type' => 'static',
            'path' => '/home/beacon/app.example.com',
            'web_directory' => '/dist',
            'repository' => 'https://github.com/example/site.git',
            'deploy_script' => app(DeployScriptFactory::class)->forSite(
                Site::factory()->make(['type' => 'static']),
            ),
        ]);

        $this->mock(SiteFilesystem::class, function (MockInterface $mock) use ($site): void {
            $mock->shouldReceive('stat')
                ->with("{$site->path}/package.json")
                ->andThrow(new \RuntimeException('missing'));

            $mock->shouldReceive('stat')
                ->with("{$site->path}/dist/index.html")
                ->andThrow(new \RuntimeException('missing'));

            $mock->shouldReceive('stat')
                ->with("{$site->path}/dist/index.htm")
                ->andThrow(new \RuntimeException('missing'));

            $mock->shouldReceive('stat')
                ->with("{$site->path}/index.html")
                ->andReturn(['size' => 100, 'mode' => 0664, 'mtime' => time()]);
        });

        $this->mock(NginxService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('generateAndApply')->once();
        });

        $stream = $this->outputStream();

        app(DeployPreflight::class)->prepare($site, $stream);

        $this->assertSame('/', $site->fresh()->web_directory);
        $this->assertStringContainsString('Document root set to /', $stream->buffer);
    }

    public function test_laravel_site_without_composer_json_fails_preflight(): void
    {
        $site = Site::factory()->laravel()->create([
            'path' => '/home/beacon/app.example.com',
            'repository' => 'https://github.com/example/site.git',
        ]);

        $this->mock(SiteFilesystem::class, function (MockInterface $mock) use ($site): void {
            $mock->shouldReceive('stat')
                ->with("{$site->path}/composer.json")
                ->andThrow(new \RuntimeException('missing'));
        });

        $this->expectException(DeploymentFailedException::class);
        $this->expectExceptionMessage('composer.json');

        app(DeployPreflight::class)->prepare($site, $this->outputStream());
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
