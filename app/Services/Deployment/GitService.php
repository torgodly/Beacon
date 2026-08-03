<?php

namespace App\Services\Deployment;

use App\Contracts\OutputStream;
use App\Models\Site;
use App\Services\System\ProcessRunner;
use App\Services\System\SiteFilesystem;
use RuntimeException;

class GitService
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly SiteFilesystem $filesystem,
    ) {}

    public function syncWorkingTree(Site $site, OutputStream $stream): void
    {
        if (blank($site->repository)) {
            $stream->append("No repository configured — skipping source fetch.\n");

            return;
        }

        $branch = $site->repository_branch ?: 'main';
        $env = $this->gitEnvironment($site);
        $repository = $this->repositoryUrl($site);

        if (! $this->isGitRepository($site)) {
            $stream->append("Cloning {$repository} (branch {$branch})...\n");

            $result = $this->runner->asSite(
                argv: [
                    '/usr/bin/git', 'clone', '--depth', '1',
                    '--branch', $branch,
                    $repository,
                    '.',
                ],
                cwd: $site->path,
                env: $env,
                timeout: 600,
                stream: $stream,
            );

            if ($result->failed()) {
                throw new RuntimeException(
                    "Git clone failed with exit code {$result->exitCode()}.",
                );
            }

            return;
        }

        $stream->append("Fetching latest from origin/{$branch}...\n");

        $fetch = $this->runner->asSite(
            argv: ['/usr/bin/git', 'fetch', 'origin', $branch],
            cwd: $site->path,
            env: $env,
            timeout: 300,
            stream: $stream,
        );

        if ($fetch->failed()) {
            throw new RuntimeException(
                "Git fetch failed with exit code {$fetch->exitCode()}.",
            );
        }

        $reset = $this->runner->asSite(
            argv: ['/usr/bin/git', 'reset', '--hard', "origin/{$branch}"],
            cwd: $site->path,
            env: $env,
            timeout: 120,
            stream: $stream,
        );

        if ($reset->failed()) {
            throw new RuntimeException(
                "Git reset failed with exit code {$reset->exitCode()}.",
            );
        }
    }

    public function remoteHead(Site $site): ?string
    {
        if (blank($site->repository)) {
            return null;
        }

        $branch = $site->repository_branch ?: 'main';

        $result = $this->runner->asSite(
            argv: ['/usr/bin/git', 'ls-remote', $this->repositoryUrl($site), "refs/heads/{$branch}"],
            cwd: $site->path,
            env: $this->gitEnvironment($site),
            timeout: 60,
        );

        if ($result->failed() || blank($result->output())) {
            return null;
        }

        $output = trim($result->output());

        if ($output === '') {
            return null;
        }

        $lines = explode("\n", $output);
        $firstLine = trim($lines[0]);

        if ($firstLine === '') {
            return null;
        }

        return preg_split('/\s+/', $firstLine)[0] ?? null;
    }

    /**
     * @return array<string, string>
     */
    public function gitEnvironment(Site $site): array
    {
        $env = [
            'GIT_TERMINAL_PROMPT' => '0',
        ];

        if (filled($site->deploy_key_path)) {
            $env['GIT_SSH_COMMAND'] = sprintf(
                'ssh -i %s -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new',
                $site->deploy_key_path,
            );
        }

        return $env;
    }

    public function repositoryUrl(Site $site): string
    {
        $repository = trim((string) $site->repository);

        if (
            $site->repository_provider === 'github'
            && ! str_contains($repository, '://')
            && str_contains($repository, '/')
        ) {
            return "https://github.com/{$repository}.git";
        }

        return $repository;
    }

    private function isGitRepository(Site $site): bool
    {
        $result = $this->runner->asSite(
            argv: ['/usr/bin/test', '-d', '.git'],
            cwd: $site->path,
            timeout: 10,
        );

        return $result->successful();
    }

    /**
     * @return array{path: string, public: string}
     */
    public function generateDeployKey(Site $site): array
    {
        $sshDir = rtrim((string) config('beacon.paths.ssh_dir'), '/');
        $keyPath = "{$sshDir}/id_ed25519_{$site->name}";
        $publicPath = "{$keyPath}.pub";

        if ($site->deploy_key_path !== null) {
            throw new RuntimeException('This site already has a deploy key. Remove it before generating a new one.');
        }

        $result = $this->runner->asSite(
            argv: [
                '/usr/bin/ssh-keygen',
                '-t', 'ed25519',
                '-f', $keyPath,
                '-N', '',
                '-C', "beacon-{$site->name}",
            ],
            cwd: $sshDir,
            timeout: 30,
        );

        if ($result->failed()) {
            throw new RuntimeException(trim($result->errorOutput()) ?: 'Could not generate deploy key.');
        }

        $public = trim($this->filesystem->read($publicPath));

        $site->update([
            'deploy_key_path' => $keyPath,
            'deploy_key_public' => $public,
        ]);

        $site->activity()->log('site.deploy_key_generated');

        return ['path' => $keyPath, 'public' => $public];
    }
}
