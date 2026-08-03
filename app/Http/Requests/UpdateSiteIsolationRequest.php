<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSiteIsolationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'open_basedir' => filter_var($this->input('open_basedir'), FILTER_VALIDATE_BOOLEAN),
            'strict_functions' => filter_var($this->input('strict_functions'), FILTER_VALIDATE_BOOLEAN),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'open_basedir' => ['required', 'boolean'],
            'strict_functions' => ['required', 'boolean'],
            'open_basedir_extra_paths' => ['nullable', 'array'],
            'open_basedir_extra_paths.*' => ['string', 'max:255'],
        ];
    }
}
