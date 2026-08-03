<?php

namespace Tests\Support;

trait AssertsTemplateFixtures
{
    protected function assertMatchesTemplateFixture(string $fixture, string $actual): void
    {
        $path = base_path("tests/fixtures/templates/{$fixture}");

        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }

        $normalized = rtrim($actual)."\n";

        if (! is_file($path)) {
            file_put_contents($path, $normalized);
            $this->fail("Created template fixture {$fixture} — re-run tests to verify.");
        }

        $this->assertSame(
            file_get_contents($path),
            $normalized,
            "Template fixture {$fixture} is out of date. Update tests/fixtures/templates/{$fixture} if the change is intentional.",
        );
    }
}
