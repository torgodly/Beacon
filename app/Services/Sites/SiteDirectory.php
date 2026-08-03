<?php

namespace App\Services\Sites;

use App\Models\Site;
use App\Services\System\ProcessResult;
use App\Services\System\ProcessRunner;
use RuntimeException;

/**
 * Owns the on-disk layout and permissions of a site.
 *
 * Shared by site creation and by later changes to the document root, so the
 * two cannot drift: a directory created by one path and a directory created by
 * the other must end up with identical ownership, or the site silently starts
 * returning 403 after an edit.
 */
class SiteDirectory
{
    public function __construct(private readonly ProcessRunner $runner) {}

    /**
     * Create the site root, its document root, and the private PHP directories.
     */
    public function provision(Site $site): void
    {
        $this->mkdir($site->path);
        $this->ensureWebRoot($site);
        $this->grantWebServerAccess($site->path);

        // Created after the group sweep, which would otherwise widen them back
        // to group-readable. These back the FPM pool's sys_temp_dir and
        // session.save_path, so they only matter when a pool exists — and
        // nginx has no business reading another site's sessions.
        if (filled($site->php_version)) {
            $this->mkdir("{$site->path}/storage/tmp", '0700');
            $this->mkdir("{$site->path}/storage/sessions", '0700');
        }
    }

    /**
     * Make sure the configured document root exists and nginx can read it.
     *
     * Nginx does not fail to start when `root` points at a missing directory —
     * it just 404s every request, which looks like a broken deploy rather than
     * a misconfiguration.
     */
    public function ensureWebRoot(Site $site): void
    {
        $webRoot = rtrim($site->path.$site->web_directory, '/');

        if ($webRoot === '' || $webRoot === $site->path) {
            return;
        }

        $this->mkdir($webRoot);
        $this->grantWebServerAccess($site->path);
    }

    /**
     * Group-own the tree to www-data, with setgid so it stays that way.
     *
     * `mkdir` as the beacon user produces beacon:beacon directories, which
     * www-data cannot traverse — every static and Laravel site would answer
     * 403. The setgid bit makes files created later by git, composer or npm
     * inherit the group, so permissions do not decay after the first deploy.
     */
    public function grantWebServerAccess(string $path): void
    {
        $this->run(['/bin/chgrp', '-R', 'www-data', $path]);

        // 2750: owner rwx, group r-x plus setgid, world nothing.
        $this->run(['/bin/find', $path, '-type', 'd', '-exec', 'chmod', '2750', '{}', '+']);
    }

    public function mkdir(string $path, ?string $mode = null): void
    {
        $result = $this->run(['/bin/mkdir', '-p', $path]);

        if ($result->failed()) {
            throw new RuntimeException(
                "Could not create directory {$path}: {$result->errorOutput()}",
            );
        }

        if ($mode !== null) {
            $this->run(['/bin/chmod', $mode, $path]);
        }
    }

    /**
     * @param  list<string>  $argv
     */
    private function run(array $argv): ProcessResult
    {
        return $this->runner->asSite(
            argv: $argv,
            // The sites home itself, which beacon-run permits as a working
            // directory; a per-site cwd would not exist on the first mkdir.
            cwd: rtrim((string) config('beacon.paths.sites_home'), '/'),
        );
    }
}
