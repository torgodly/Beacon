<?php

namespace Tests\Feature;

use App\Actions\Site\CreateSite;
use App\Models\PhpVersion;
use App\Models\Server;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

/**
 * The panel's response headers must fit in one nginx FastCGI buffer.
 *
 * nginx reads an upstream's entire header block into a single allocation sized
 * by `fastcgi_buffer_size`. Exceed it and nginx does not truncate — it aborts
 * the response with 502 "upstream sent too big header". To the operator that is
 * indistinguishable from a dead panel: the page is blank, a refresh gives Bad
 * Gateway, and PHP's own logs are clean because PHP completed the request
 * successfully.
 *
 * This is exactly how it reached production. `AddLinkHeadersForPreloadedAssets`
 * emitted one `Link: rel="preload"` entry per Vite chunk, and because
 * app.blade.php passes the current page component to @vite, that header is
 * per-page and scales with the page's import graph. Measured against the
 * beacon.abdo.ly host, totals were:
 *
 *   dashboard       3,919   (under 4 KB — the one page that still loaded)
 *   sites.index     4,285
 *   services.index  4,378
 *   php.index       4,648
 *   runtimes.index  4,741
 *   sites.show      5,103   (heaviest page in the panel)
 *
 * The failure was invisible in normal use: client-side Inertia navigation
 * returns JSON without rendering Blade, so it carries no Link header at all.
 * Only a full page load — a first visit or a refresh — hit the limit, and the
 * dashboard people land on happened to sit just under it.
 *
 * The budget is 2 KB, deliberately far below both nginx's 4 KB default and the
 * 32 KB Beacon now provisions. A 4 KB assertion would be near-useless: these
 * totals sit within a few hundred bytes of the cliff, so whether it trips
 * depends on hostname length and cookie size rather than on anything a test
 * controls. The panel sends ~1 KB today; 2 KB leaves room for new headers while
 * still catching anything that reintroduces per-asset header growth.
 */
class ResponseHeaderBudgetTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Half of nginx's compiled-in default `fastcgi_buffer_size` of one 4 KB page.
     */
    private const BUDGET_BYTES = 2048;

    protected function setUp(): void
    {
        parent::setUp();

        $factory = new FakeProcessFactory;
        $factory->willReturn(0, "server { listen 80; }\n");
        $this->app->instance(ProcessFactory::class, $factory);

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
    public static function panelRoutes(): array
    {
        return [
            'dashboard' => ['dashboard'],
            'sites index' => ['sites.index'],
            'services' => ['services.index'],
            'php' => ['php.index'],
            'runtimes' => ['runtimes.index'],
            'databases' => ['databases.index'],
            'activity' => ['activity.index'],
        ];
    }

    #[DataProvider('panelRoutes')]
    public function test_panel_pages_fit_in_one_fastcgi_buffer(string $route): void
    {
        $response = $this->actingAs(User::factory()->create())->get(route($route));

        $this->assertHeadersWithinBudget($response, $route);
    }

    /**
     * The site detail page is the heaviest route in the panel and the one that
     * actually blew the budget, so every site type is measured.
     *
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
    public function test_the_site_detail_page_fits_in_one_fastcgi_buffer(string $type): void
    {
        $site = app(CreateSite::class)->handle([
            'name' => "{$type}.example.com",
            'type' => $type,
            'php_version' => $type === 'laravel' ? '8.4' : null,
            'node_version' => in_array($type, ['nextjs', 'nuxt'], true) ? '22' : null,
        ]);

        $response = $this->actingAs(User::factory()->create())
            ->get(route('sites.show', $site));

        $this->assertHeadersWithinBudget($response, "sites.show ({$type})");
    }

    private function assertHeadersWithinBudget(TestResponse $response, string $label): void
    {
        $total = 0;
        $breakdown = [];

        foreach ($response->headers->allPreserveCase() as $name => $values) {
            foreach ($values as $value) {
                // "Name: value\r\n" — how nginx measures it.
                $bytes = strlen($name) + 2 + strlen((string) $value) + 2;
                $total += $bytes;
                $breakdown[] = "{$bytes}\t{$name}";
            }
        }

        rsort($breakdown, SORT_NATURAL);

        $this->assertLessThan(
            self::BUDGET_BYTES,
            $total,
            "{$label} sends {$total} bytes of response headers, over the ".self::BUDGET_BYTES
            ." byte nginx default. nginx answers 502 rather than truncating. Largest first:\n"
            .implode("\n", array_slice($breakdown, 0, 10))
        );
    }
}
