<?php

namespace App\Http\Requests;

use App\Models\Server;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSiteRequest extends FormRequest
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
            'name' => [
                'required',
                'string',
                'max:253',
                'regex:/^[a-z0-9]([a-z0-9.-]{0,61}[a-z0-9])?$/',
                Rule::unique('sites', 'name'),
                'not_regex:/\.\./',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $hostname = Server::current()->panelHostname();

                    if ($hostname !== null && is_string($value) && strcasecmp($value, $hostname) === 0) {
                        $fail('That hostname is reserved for the Beacon panel.');
                    }

                    if (! is_string($value)) {
                        return;
                    }

                    $poolName = str_replace('.', '-', $value);

                    if (in_array($poolName, ['beacon-panel', 'www'], true)) {
                        $fail('That hostname would conflict with a reserved PHP-FPM pool name.');
                    }

                    if (! str_contains($value, '.')) {
                        $fail('Enter a full domain name (e.g. app.example.com).');
                    }

                    $labels = explode('.', $value);
                    $tld = $labels[array_key_last($labels)] ?? '';

                    if (count($labels) < 2 || strlen($tld) < 2) {
                        $fail('Enter a valid top-level domain.');
                    }
                },
            ],
            'type' => ['required', Rule::in(['laravel', 'nextjs', 'nuxt', 'static'])],

            // A PHP version is required for Laravel, and *prohibited* for
            // everything else — a static site has no FPM pool, so accepting
            // the field and silently discarding it is how the form ended up
            // asking for it in the first place.
            'php_version' => [
                Rule::requiredIf(fn (): bool => $this->input('type') === 'laravel'),
                Rule::prohibitedIf(fn (): bool => $this->input('type') !== 'laravel'),
                'nullable',
                Rule::exists('php_versions', 'version')->where('status', 'installed'),
            ],

            'app_env' => [
                Rule::requiredIf(fn (): bool => $this->input('type') === 'laravel'),
                Rule::prohibitedIf(fn (): bool => $this->input('type') !== 'laravel'),
                Rule::in(['testing', 'staging', 'production']),
            ],

            'database_driver' => [
                Rule::requiredIf(fn (): bool => $this->input('type') === 'laravel'),
                Rule::prohibitedIf(fn (): bool => $this->input('type') !== 'laravel'),
                Rule::in(['mysql', 'sqlite']),
            ],

            'redis_enabled' => [
                'sometimes',
                'boolean',
                Rule::prohibitedIf(fn (): bool => $this->input('type') !== 'laravel'),
            ],

            'node_version' => [
                Rule::requiredIf(fn (): bool => $this->needsNode()),
                Rule::prohibitedIf(fn (): bool => ! $this->needsNode() && $this->input('type') !== 'static'),
                'nullable',
                'string',
                'max:16',
                Rule::exists('node_versions', 'version')->where('runtime', 'node'),
            ],
            'spa_fallback' => ['sometimes', 'boolean'],

            // Advanced overrides. Each falls back to a per-type default in
            // CreateSite when omitted, so the simple path stays one field.
            'web_directory' => UpdateSiteServingRequest::WEB_DIRECTORY_RULES,
            'client_max_body_size' => UpdateSiteServingRequest::BODY_SIZE_RULES,
            'package_manager' => ['nullable', Rule::in(['npm', 'bun'])],
            'repository' => ['nullable', 'string', 'max:500'],
            'repository_branch' => [
                'nullable',
                'string',
                'max:255',
                'required_with:repository',
            ],
            'github_repo_id' => ['nullable', 'integer'],
            'github_repository' => [
                'nullable',
                'string',
                'max:500',
                'required_with:github_repo_id',
            ],

            'auto_deploy' => ['sometimes', 'boolean'],

            'database_strategy' => [
                Rule::requiredIf(fn (): bool => $this->usesMysql()),
                Rule::prohibitedIf(fn (): bool => ! $this->usesMysql()),
                Rule::in(['none', 'create', 'existing']),
            ],
            'database_id' => [
                'nullable',
                'integer',
                Rule::requiredIf(fn (): bool => $this->usesMysql()
                    && $this->input('database_strategy') === 'existing'),
                Rule::prohibitedIf(fn (): bool => ! $this->usesMysql()
                    || $this->input('database_strategy') !== 'existing'),
                Rule::exists('databases', 'id')->where(
                    fn ($query) => $query->where('server_id', Server::current()->id),
                ),
            ],
            'database_name' => [
                'nullable',
                'string',
                'max:64',
                'regex:/^[A-Za-z0-9_]{1,64}$/',
                Rule::requiredIf(fn (): bool => $this->usesMysql()
                    && $this->input('database_strategy') === 'create'),
                Rule::prohibitedIf(fn (): bool => ! $this->usesMysql()
                    || $this->input('database_strategy') !== 'create'),
                Rule::unique('databases', 'name'),
            ],
        ];
    }

    /** Static sites may optionally build with Node; SSR types require it. */
    private function needsNode(): bool
    {
        return in_array($this->input('type'), ['nextjs', 'nuxt'], true);
    }

    private function usesMysql(): bool
    {
        return $this->input('type') === 'laravel'
            && $this->input('database_driver', 'mysql') === 'mysql';
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('auto_deploy')) {
            $this->merge([
                'auto_deploy' => filter_var($this->input('auto_deploy'), FILTER_VALIDATE_BOOLEAN),
            ]);
        }
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.regex' => 'Enter a valid hostname (lowercase letters, numbers, dots, hyphens).',
            'php_version.exists' => 'That PHP version is not installed on this server.',
            'php_version.prohibited' => 'Only Laravel sites run under PHP-FPM.',
            'node_version.exists' => 'That Node version is not installed on this server.',
            'app_env.required' => 'Choose an application environment.',
            'app_env.in' => 'Environment must be testing, staging, or production.',
            'database_driver.required' => 'Choose a database driver.',
            'database_driver.in' => 'Database driver must be MySQL or SQLite.',
            'database_strategy.required' => 'Choose how this Laravel site should use MySQL.',
            'database_id.required' => 'Select an existing database or choose to create a new one.',
            'database_id.exists' => 'That database does not exist on this server.',
            'database_name.required' => 'Enter a name for the new database.',
            'database_name.regex' => 'Database names may only contain letters, numbers, and underscores.',
            'database_name.unique' => 'That database name is already in use.',
        ];
    }

    /**
     * @return array{name: string, type: string, php_version?: string|null, app_env?: string|null, database_driver?: string|null, redis_enabled?: bool, node_version?: string|null, spa_fallback?: bool, web_directory?: string|null, client_max_body_size?: string|null, package_manager?: string|null, repository?: string|null, repository_branch?: string|null, database_strategy?: string|null, database_id?: int|null, database_name?: string|null}
     */
    public function siteData(): array
    {
        $data = [
            'name' => $this->validated('name'),
            'type' => $this->validated('type'),
            'php_version' => $this->validated('php_version'),
            'node_version' => $this->validated('node_version'),
            'spa_fallback' => $this->boolean('spa_fallback'),
            'web_directory' => $this->validated('web_directory'),
            'client_max_body_size' => $this->validated('client_max_body_size'),
            'package_manager' => $this->validated('package_manager'),
            'repository' => $this->validated('repository'),
            'repository_branch' => $this->validated('repository_branch'),
            'auto_deploy' => $this->boolean('auto_deploy'),
        ];

        if ($data['type'] === 'laravel') {
            $data['app_env'] = $this->validated('app_env');
            $data['database_driver'] = $this->validated('database_driver');
            $data['redis_enabled'] = $this->boolean('redis_enabled');

            if ($data['database_driver'] === 'mysql') {
                $data['database_strategy'] = $this->validated('database_strategy');
                $data['database_id'] = $this->validated('database_id');
                $data['database_name'] = $this->validated('database_name');
            } else {
                $data['database_strategy'] = 'none';
            }
        }

        return $data;
    }
}
