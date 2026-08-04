<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSiteDomainSettingsRequest extends FormRequest
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
            'allow_wildcard_subdomains' => ['required', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'allow_wildcard_subdomains' => filter_var(
                $this->input('allow_wildcard_subdomains'),
                FILTER_VALIDATE_BOOLEAN,
            ),
        ]);
    }
}
