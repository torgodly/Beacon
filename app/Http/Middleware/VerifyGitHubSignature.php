<?php

namespace App\Http\Middleware;

use App\Models\GithubInstallation;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyGitHubSignature
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $signature = (string) $request->header('X-Hub-Signature-256', '');

        if ($signature === '') {
            abort(401, 'Missing GitHub signature.');
        }

        $payload = $request->getContent();
        $installation = $this->matchingInstallation($payload, $signature);

        if ($installation === null) {
            abort(401, 'Invalid GitHub signature.');
        }

        $request->attributes->set('github_installation', $installation);

        return $next($request);
    }

    private function matchingInstallation(string $payload, string $signature): ?GithubInstallation
    {
        foreach (GithubInstallation::query()->whereNotNull('webhook_secret')->get() as $installation) {
            $expected = 'sha256='.hash_hmac('sha256', $payload, $installation->webhook_secret);

            if (hash_equals($expected, $signature)) {
                return $installation;
            }
        }

        return null;
    }
}
