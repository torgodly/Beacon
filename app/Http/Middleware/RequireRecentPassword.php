<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Http\Request;

class RequireRecentPassword extends RequirePassword
{
    /**
     * @param  list<string>  $sensitiveTabs
     */
    public function handle($request, Closure $next, $redirectToRoute = null, $passwordTimeoutSeconds = null, ...$sensitiveTabs)
    {
        if ($sensitiveTabs !== [] && ! $this->appliesToRequest($request, $sensitiveTabs)) {
            return $next($request);
        }

        if ($this->shouldConfirmPassword($request, $passwordTimeoutSeconds)) {
            if ($request->expectsJson()) {
                return $this->responseFactory->json([
                    'message' => 'Password confirmation required.',
                ], 423);
            }

            $this->storeSafeIntendedUrl($request);

            return $this->responseFactory->redirectGuest(
                $this->urlGenerator->route($redirectToRoute ?: 'password.confirm'),
            )->with('toast', [
                'type' => 'info',
                'message' => 'Confirm your password to continue.',
            ]);
        }

        return $next($request);
    }

    /**
     * @param  list<string>  $sensitiveTabs
     */
    protected function appliesToRequest(Request $request, array $sensitiveTabs): bool
    {
        if (! $request->routeIs('sites.show')) {
            return true;
        }

        $tab = $request->query('tab', 'overview');

        return in_array($tab, $sensitiveTabs, true);
    }

    protected function storeSafeIntendedUrl(Request $request): void
    {
        if (! $request->isMethod('POST') && ! $request->isMethod('PATCH') && ! $request->isMethod('PUT') && ! $request->isMethod('DELETE')) {
            return;
        }

        $referer = $request->headers->get('Referer');

        if ($referer === null || $referer === '') {
            return;
        }

        $request->session()->put('url.intended', $referer);
    }
}
