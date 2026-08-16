<?php

namespace App\Services\Deployment;

use App\Contracts\OutputStream;
use App\Models\GithubInstallation;
use App\Models\Site;
use App\Services\Github\GitHubAppClient;
use App\Services\System\ProcessRunner;
use App\Services\System\SiteFilesystem;
use RuntimeException;

class GitService
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly SiteFilesystem $filesystem,
        private readonly GitHubAppClient $github,
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
            $this->initializeRepository($site, $repository, $branch, $env, $stream);

            return;
        }

        $stream->append("Fetching latest from origin/{$branch}...\n");

        $this->ensureRemoteOrigin($site, $repository, $env, $stream);

        $fetch = $this->runner->asSite(
            argv: $this->gitArgv($site, ['fetch', 'origin', $branch]),
            cwd: $site->path,
            env: $env,
            timeout: 300,
            stream: $stream,
        );

        if ($fetch->failed()) {
            throw new RuntimeException(
                $this->authHint(
                    $site,
                    "Git fetch failed with exit code {$fetch->exitCode()}.",
                ),
            );
        }

        $reset = $this->runner->asSite(
            argv: $this->gitArgv($site, ['reset', '--hard', "origin/{$branch}"]),
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

    /**
     * @return list<string>
     */
    public function listRemoteBranches(string $repository, ?GithubInstallation $installation = null): array
    {
        $url = $this->normalizeRepositoryUrl($repository);
        $sitesHome = rtrim((string) config('beacon.paths.sites_home'), '/');
        $argv = ['/usr/bin/git', ...$this->githubHttpsConfig($installation, $url), 'ls-remote', '--heads', $url];

        $result = $this->runner->asSite(
            argv: $argv,
            cwd: $sitesHome,
            env: ['GIT_TERMINAL_PROMPT' => '0'],
            timeout: 30,
        );

        if ($result->failed()) {
            throw new RuntimeException(
                trim($result->errorOutput()) ?: 'Could not list remote branches.',
            );
        }

        $branches = [];

        foreach (explode("\n", trim($result->output())) as $line) {
            if ($line === '') {
                continue;
            }

            if (preg_match('#refs/heads/(.+)$#', $line, $matches) === 1) {
                $branches[] = $matches[1];
            }
        }

        sort($branches);

        return $branches;
    }

    public function normalizeRepositoryUrl(string $repository): string
    {
        $repository = trim($repository);

        if (
            ! str_contains($repository, '://')
            && str_contains($repository, '/')
            && ! str_starts_with($repository, 'git@')
        ) {
            return "https://github.com/{$repository}.git";
        }

        return $repository;
    }

    public function remoteHead(Site $site): ?string
    {
        if (blank($site->repository)) {
            return null;
        }

        $branch = $site->repository_branch ?: 'main';
        $url = $this->repositoryUrl($site);

        $result = $this->runner->asSite(
            argv: $this->gitArgv($site, ['ls-remote', $url, "refs/heads/{$branch}"]),
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
        return $this->normalizeRepositoryUrl((string) $site->repository);
    }

    /**
     * Bootstrap git in an existing site directory.
     *
     * Site provisioning creates storage/ and web roots before the first
     * deploy, so `git clone .` into the site path always fails. Instead we
     * init the repo in place and fetch the requested branch.
     *
     * @param  array<string, string>  $env
     */
    private function initializeRepository(
        Site $site,
        string $repository,
        string $branch,
        array $env,
        OutputStream $stream,
    ): void {
        $stream->append("Initializing {$repository} (branch {$branch})...\n");

        $init = $this->runner->asSite(
            argv: $this->gitArgv($site, ['init']),
            cwd: $site->path,
            env: $env,
            timeout: 60,
            stream: $stream,
        );

        if ($init->failed()) {
            throw new RuntimeException(
                "Git init failed with exit code {$init->exitCode()}.",
            );
        }

        $this->ensureRemoteOrigin($site, $repository, $env, $stream);

        $fetch = $this->runner->asSite(
            argv: $this->gitArgv($site, ['fetch', 'origin', $branch, '--depth', '1']),
            cwd: $site->path,
            env: $env,
            timeout: 600,
            stream: $stream,
        );

        if ($fetch->failed()) {
            throw new RuntimeException(
                $this->authHint(
                    $site,
                    "Git fetch failed with exit code {$fetch->exitCode()}.",
                ),
            );
        }

        $reset = $this->runner->asSite(
            argv: $this->gitArgv($site, ['reset', '--hard', "origin/{$branch}"]),
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

    /**
     * @param  array<string, string>  $env
     */
    private function ensureRemoteOrigin(
        Site $site,
        string $repository,
        array $env,
        OutputStream $stream,
    ): void {
        $existing = $this->runner->asSite(
            argv: $this->gitArgv($site, ['remote', 'get-url', 'origin']),
            cwd: $site->path,
            env: $env,
            timeout: 10,
        );

        $argv = $existing->successful()
            ? $this->gitArgv($site, ['remote', 'set-url', 'origin', $repository])
            : $this->gitArgv($site, ['remote', 'add', 'origin', $repository]);

        $result = $this->runner->asSite(
            argv: $argv,
            cwd: $site->path,
            env: $env,
            timeout: 30,
            stream: $stream,
        );

        if ($result->failed()) {
            throw new RuntimeException(
                'Could not configure git remote origin.',
            );
        }
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
     * @param  list<string>  $args
     * @return list<string>
     */
    private function gitArgv(Site $site, array $args): array
    {
        $site->loadMissing('githubInstallation');

        return [
            '/usr/bin/git',
            ...$this->githubHttpsConfig($site->githubInstallation, $this->repositoryUrl($site)),
            ...$args,
        ];
    }

    /**
     * Authenticate private GitHub HTTPS remotes with an App installation token.
     * Token is passed only via a one-shot git config flag — never written into .git/config.
     *
     * @return list<string>
     */
    private function githubHttpsConfig(?GithubInstallation $installation, string $repositoryUrl): array
    {
        if ($installation === null || $installation->installation_id === null) {
            return [];
        }

        if (! $this->isGitHubHttpsUrl($repositoryUrl)) {
            return [];
        }

        try {
            $token = $this->github->installationToken($installation);
        } catch (RuntimeException) {
            return [];
        }

        $basic = base64_encode("x-access-token:{$token}");

        return [
            '-c',
            "http.https://github.com/.extraheader=AUTHORIZATION: basic {$basic}",
        ];
    }

    private function isGitHubHttpsUrl(string $url): bool
    {
        return (bool) preg_match('#^https://github\.com/#i', $url);
    }

    private function authHint(Site $site, string $message): string
    {
        $site->loadMissing('githubInstallation');

        if ($site->githubInstallation?->installation_id !== null) {
            return $message;
        }

        if (filled($site->deploy_key_path)) {
            return $message.' If this is a private repo, add the site deploy key on GitHub or reconnect the GitHub App.';
        }

        return $message
            .' Private GitHub repos need the GitHub App connected (Settings → GitHub)'
            .' or an SSH deploy key on the site.';
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
