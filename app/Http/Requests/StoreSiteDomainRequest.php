<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSiteDomainRequest extends FormRequest
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
            'domain' => [
                'required',
                'string',
                'max:253',
                'regex:/^[a-z0-9]([a-z0-9.-]{0,61}[a-z0-9])?$/',
                Rule::unique('site_domains', 'domain'),
                'not_regex:/\.\./',
            ],
            'redirect_www' => ['sometimes', 'boolean'],
        ];
    }
}
