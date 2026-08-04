<?php

namespace App\Http\Controllers\Sites;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateSiteSettingsRequest;
use App\Models\GithubInstallation;
use App\Models\Site;
use App\Services\Deployment\GitService;
use App\Support\SiteDeploySettings;
use Illuminate\Http\RedirectResponse;

class SiteSettingsController extends Controller
{
    public function update(UpdateSiteSettingsRequest $request, Site $site): RedirectResponse
    {
        $data = $request->validated();

        if ($request->filled('github_repo_id') && $request->filled('github_repository')) {
            $installation = GithubInstallation::query()
                ->where('user_id', $request->user()->id)
                ->whereNotNull('installation_id')
                ->first();

            if ($installation !== null) {
                $data['github_installation_id'] = $installation->id;
                $data['github_repo_id'] = (int) $request->input('github_repo_id');
                $data['repository'] = (string) $request->input('github_repository');
                $data['repository_provider'] = 'github';
            }
        }

        if (blank($data['repository'])) {
            $data['repository_provider'] = null;
            $data['github_installation_id'] = null;
            $data['github_repo_id'] = null;
        }

        $data = SiteDeploySettings::normalize($data, $site);

        unset($data['github_repository']);

        $site->update($data);
        $site->activity()->log('site.settings_updated');

        return back()->with('toast', ['type' => 'success', 'message' => 'Site settings saved.']);
    }

    public function generateDeployKey(Site $site, GitService $git): RedirectResponse
    {
        try {
            $git->generateDeployKey($site);
        } catch (\RuntimeException $e) {
            return back()->withErrors(['deploy_key' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'Deploy key generated.']);
    }
}
