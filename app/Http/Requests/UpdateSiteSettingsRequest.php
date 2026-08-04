<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSiteSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'repository' => ['nullable', 'string', 'max:500'],
            'repository_branch' => ['nullable', 'string', 'max:255'],
            'repository_provider' => ['nullable', Rule::in(['github', 'custom'])],
            'github_repo_id' => ['nullable', 'integer'],
            'github_repository' => ['nullable', 'string', 'max:500'],
            'auto_deploy' => ['required', 'boolean'],
            'deploy_trigger' => ['required', Rule::in(['manual', 'poll', 'webhook'])],
            'poll_interval_seconds' => [
                'nullable',
                'integer',
                'min:'.config('beacon.deployments.min_poll_interval_seconds', 30),
                'max:'.config('beacon.deployments.max_poll_interval_seconds', 3600),
            ],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'auto_deploy' => filter_var($this->input('auto_deploy'), FILTER_VALIDATE_BOOLEAN),
        ]);

        if ($this->input('poll_interval_seconds') === '') {
            $this->merge(['poll_interval_seconds' => null]);
        }
    }
}
