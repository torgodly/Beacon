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
            'php_version' => [
                Rule::requiredIf(fn (): bool => $this->input('type') === 'laravel'),
                'nullable',
                Rule::in(config('beacon.php_versions', [])),
            ],
            'node_version' => [
                Rule::requiredIf(fn (): bool => in_array($this->input('type'), ['nextjs', 'nuxt'], true)),
                'nullable',
                'string',
                'max:16',
            ],
            'spa_fallback' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.regex' => 'Enter a valid hostname (lowercase letters, numbers, dots, hyphens).',
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
