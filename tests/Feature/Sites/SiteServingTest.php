<?php

namespace Tests\Feature\Sites;

use App\Models\PhpVersion;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

/**
 * Document root, SPA fallback and upload ceiling.
 *
 * `web_directory` is interpolated straight into the vhost's `root` directive,
 * so the rejection cases below are load-bearing rather than cosmetic: a value
 * containing a newline or a semicolon would inject nginx configuration, and
 * `..` would let a site point outside its own directory.
 */
class SiteServingTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->processFactory->willReturn(0, "server { listen 80; }\n");
        $this->app->instance(ProcessFactory::class, $this->processFactory);

        Server::factory()->create(['id' => 1]);
        PhpVersion::query()->create([
            'server_id' => 1,
            'version' => '8.4',
            'status' => 'installed',
        ]);
    }

    public function test_document_root_can_be_changed_after_creation(): void
    {
        $site = $this->makeSite('static');

        $response = $this->actingAs(User::factory()->create())
            ->patch(route('sites.serving.update', $site), [
                'web_directory' => '/build',
                'spa_fallback' => '1',
                'client_max_body_size' => '250M',
            ]);

        $response->assertRedirect();

        $site->refresh();
        $this->assertSame('/build', $site->web_directory);
        $this->assertTrue((bool) $site->spa_fallback);
        $this->assertSame('250M', $site->client_max_body_size);
    }

    public function test_the_new_document_root_is_created_on_disk(): void
    {
        $site = $this->makeSite('static');
        $this->processFactory->calls = [];

        $this->actingAs(User::factory()->create())
            ->patch(route('sites.serving.update', $site), ['web_directory' => '/out']);

        // nginx does not fail on a missing root — it just 404s everything.
        $this->assertTrue(
            collect($this->siteJobs())->contains(
                fn (array $job): bool => $job['argv'] === ['/bin/mkdir', '-p', "{$site->path}/out"],
            ),
            'The document root should be created before nginx is pointed at it.',
        );
    }

    public function test_a_leading_slash_is_optional(): void
    {
        $site = $this->makeSite('static');

        $this->actingAs(User::factory()->create())
            ->patch(route('sites.serving.update', $site), ['web_directory' => 'dist/']);

        $this->assertSame('/dist', $site->fresh()->web_directory);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function dangerousRoots(): array
    {
        return [
            'traversal' => ['/../../etc'],
            'traversal mid-path' => ['/public/../../../root'],
            'directive injection' => ['/public; root /etc'],
            'newline injection' => ["/public\nroot /etc;"],
            'command substitution' => ['/public$(whoami)'],
            'brace injection' => ['/public} location / { root /etc'],
            'absolute escape' => ['//etc/passwd '],
        ];
    }

    #[DataProvider('dangerousRoots')]
    public function test_dangerous_document_roots_are_rejected(string $value): void
    {
        $site = $this->makeSite('static');

        $response = $this->actingAs(User::factory()->create())
            ->patch(route('sites.serving.update', $site), ['web_directory' => $value]);

        $response->assertSessionHasErrors('web_directory');
        $this->assertSame('/dist', $site->fresh()->web_directory);
    }

    public function test_upload_size_must_be_nginx_syntax(): void
    {
        $site = $this->makeSite('static');

        $this->actingAs(User::factory()->create())
            ->patch(route('sites.serving.update', $site), [
                'client_max_body_size' => '100 megabytes',
            ])
            ->assertSessionHasErrors('client_max_body_size');
    }

    public function test_a_document_root_can_be_chosen_at_creation(): void
    {
        $response = $this->actingAs(User::factory()->create())
            ->post(route('sites.store'), [
                'name' => 'spa.example.com',
                'type' => 'static',
                'web_directory' => '/out',
                'client_max_body_size' => '25M',
            ]);

        $response->assertRedirect();

        $site = Site::query()->where('name', 'spa.example.com')->firstOrFail();
        $this->assertSame('/out', $site->web_directory);
        $this->assertSame('25M', $site->client_max_body_size);
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

    private function makeSite(string $type): Site
    {
        $site = Site::factory()->create([
            'server_id' => 1,
            'name' => 'spa.example.com',
            'type' => $type,
            'path' => '/home/beacon/spa.example.com',
            'web_directory' => '/dist',
            'php_version' => null,
            'proxy_port' => null,
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => $site->name,
            'is_primary' => true,
        ]);

        return $site;
    }
}
