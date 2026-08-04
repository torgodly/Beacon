<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSiteEnvironmentRequest extends FormRequest
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
            'contents' => ['required', 'string', 'max:65535'],
            'env_cache_on_save' => ['sometimes', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('env_cache_on_save')) {
            $this->merge([
                'env_cache_on_save' => filter_var(
                    $this->input('env_cache_on_save'),
                    FILTER_VALIDATE_BOOLEAN,
                ),
            ]);
        }
    }
}
