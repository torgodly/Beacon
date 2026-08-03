<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * How Nginx serves a site: document root, SPA fallback, upload ceiling.
 *
 * `web_directory` is interpolated directly into the vhost's `root` directive,
 * so it is validated tightly rather than merely escaped — a value containing
 * `;` or a newline would otherwise inject nginx configuration, and `..` would
 * let a site escape its own directory.
 */
class UpdateSiteServingRequest extends FormRequest
{
    /** Same shape used when creating a site — keep the two in step. */
    public const WEB_DIRECTORY_RULES = [
        'nullable',
        'string',
        'max:64',
        'regex:/^\/(?:[A-Za-z0-9._-]+\/?)*$/',
        'not_regex:/\.\./',
    ];

    /** nginx size syntax: 100M, 512k, 1G, or a bare byte count. */
    public const BODY_SIZE_RULES = [
        'nullable',
        'string',
        'max:12',
        'regex:/^[0-9]{1,6}[kKmMgG]?$/',
    ];

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
            'web_directory' => self::WEB_DIRECTORY_RULES,
            'spa_fallback' => ['sometimes', 'boolean'],
            'client_max_body_size' => self::BODY_SIZE_RULES,
            'package_manager' => ['nullable', Rule::in(['npm', 'bun'])],
        ];
    }

    protected function prepareForValidation(): void
    {
        $directory = $this->input('web_directory');

        if (is_string($directory)) {
            $directory = trim($directory);
            $directory = $directory === '' ? '/' : $directory;

            // Accept "dist" as well as "/dist", and drop any trailing slash so
            // the vhost never renders a doubled separator.
            if (! str_starts_with($directory, '/')) {
                $directory = '/'.$directory;
            }

            if ($directory !== '/') {
                $directory = rtrim($directory, '/');
            }

            $this->merge(['web_directory' => $directory]);
        }

        $this->merge([
            'spa_fallback' => filter_var(
                $this->input('spa_fallback', false),
                FILTER_VALIDATE_BOOLEAN,
            ),
        ]);
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'web_directory.regex' => 'Use a path like /public or /dist — letters, numbers, dots, dashes and slashes only.',
            'web_directory.not_regex' => 'The document root cannot contain "..".',
            'client_max_body_size.regex' => 'Use an nginx size such as 100M, 512k or 1G.',
        ];
    }
}
