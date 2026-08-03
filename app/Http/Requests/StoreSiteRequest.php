<?php

namespace App\Http\Requests;

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

            'node_version' => [
                Rule::requiredIf(fn (): bool => $this->needsNode()),
                Rule::prohibitedIf(fn (): bool => ! $this->needsNode() && $this->input('type') !== 'static'),
                'nullable',
                'string',
                'max:16',
                Rule::exists('node_versions', 'version')->where('runtime', 'node'),
            ],
            'spa_fallback' => ['sometimes', 'boolean'],
        ];
    }

    /** Static sites may optionally build with Node; SSR types require it. */
    private function needsNode(): bool
    {
        return in_array($this->input('type'), ['nextjs', 'nuxt'], true);
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
        ];
    }

    /**
     * @return array{name: string, type: string, php_version?: string|null, node_version?: string|null, spa_fallback?: bool}
     */
    public function siteData(): array
    {
        return [
            'name' => $this->validated('name'),
            'type' => $this->validated('type'),
            'php_version' => $this->validated('php_version'),
            'node_version' => $this->validated('node_version'),
            'spa_fallback' => $this->boolean('spa_fallback'),
        ];
    }
}
