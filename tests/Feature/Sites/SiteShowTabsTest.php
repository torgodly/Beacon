<?php

namespace Tests\Feature\Sites;

use App\Actions\Site\CreateSite;
use App\Models\PhpVersion;
use App\Models\Server;
use App\Models\Site;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

/**
 * Every tab of a freshly created site must render.
 *
 * Creating a site redirects straight to its detail page, so a 500 there means
 * the operator sees a white screen immediately after a successful create — the
 * request succeeded, the site exists, and the UI is simply broken.
 */
class SiteShowTabsTest extends TestCase
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

    /**
     * @return array<string, array{string}>
     */
    public static function siteTypes(): array
    {
        return [
            'laravel' => ['laravel'],
            'static' => ['static'],
            'nextjs' => ['nextjs'],
            'nuxt' => ['nuxt'],
        ];
    }

    #[DataProvider('siteTypes')]
    public function test_all_tabs_render_for_a_new_site(string $type): void
    {
        $site = $this->createSite($type);
        $user = User::factory()->create();

        $tabs = [
            'overview', 'domains', 'ssl', 'nginx', 'deployments',
            'environment', 'supervisor', 'cron', 'console', 'isolation',
            'settings',
        ];

        foreach ($tabs as $tab) {
            $response = $this->actingAs($user)
                ->withSession(['auth.password_confirmed_at' => time()])
                ->get(route('sites.show', $site).'?tab='.$tab);

            $response->assertOk("{$type} site: the {$tab} tab should render");
        }
    }

    #[DataProvider('siteTypes')]
    public function test_the_detail_payload_carries_everything_the_ui_reads(string $type): void
    {
        $site = $this->createSite($type);

        $this->actingAs(User::factory()->create())
            ->get(route('sites.show', $site).'?tab=isolation')
            ->assertInertia(fn ($page) => $page
                ->component('sites/show')
                // The serving panel dereferences each of these unconditionally;
                // a missing key is an undefined-property crash in the browser,
                // which renders as a white screen rather than an error.
                ->has('site.web_directory')
                ->has('site.spa_fallback')
                ->has('site.serves_from_disk')
                ->has('site.client_max_body_size')
                ->has('site.path')
                ->has('site.nginx_customized')
            );
    }

    private function createSite(string $type): Site
    {
        return app(CreateSite::class)->handle([
            'name' => "{$type}.example.com",
            'type' => $type,
            'php_version' => $type === 'laravel' ? '8.4' : null,
            'node_version' => in_array($type, ['nextjs', 'nuxt'], true) ? '22' : null,
        ]);
    }
}
