<?php

namespace App\Services\Php;

use App\Models\PhpVersion;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use RuntimeException;

class PhpIniService
{
    public function __construct(private readonly ProcessRunner $runner) {}

    /**
     * @return array<string, string>
     */
    public function read(PhpVersion $version, string $sapi = 'fpm'): array
    {
        $defaults = config('beacon.php_ini.defaults', []);
        $stored = $version->settings()
            ->where('sapi', $sapi)
            ->pluck('value', 'key')
            ->all();

        return array_merge($defaults, $stored);
    }

    /**
     * @param  array<string, string>  $settings
     */
    public function save(PhpVersion $version, string $sapi, array $settings): void
    {
        $allowed = config('beacon.php_ini.keys', []);

        foreach ($settings as $key => $value) {
            if (! in_array($key, $allowed, true)) {
                continue;
            }

            $version->settings()->updateOrCreate(
                ['sapi' => $sapi, 'key' => $key],
                ['value' => $value],
            );
        }

        $contents = $this->renderIni($this->read($version, $sapi));

        $result = $this->runner->sudoRoot(
            SudoWrapper::Php,
            ['ini-write', $version->version, $sapi],
            stdin: $contents,
        );

        if ($result->failed()) {
            throw new RuntimeException("Could not write PHP ini: {$result->errorOutput()}");
        }

        $this->runner->sudoRoot(
            SudoWrapper::Php,
            ['fpm-restart', $version->version],
            timeout: 120,
        );
    }

    /**
     * @param  array<string, string>  $settings
     */
    private function renderIni(array $settings): string
    {
        $lines = ['; Managed by Beacon — manual edits will be overwritten.'];

        foreach ($settings as $key => $value) {
            $lines[] = "{$key} = {$value}";
        }

        return implode("\n", $lines)."\n";
    }
}
