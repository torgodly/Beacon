<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCronJobRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:128'],
            'command' => ['required', 'string', 'max:2000'],
            'expression' => ['required', 'string', 'max:128'],
            'frequency_preset' => ['nullable', 'string', 'max:32'],
            'output_redirect' => ['nullable', 'string', 'max:255'],
            'enabled' => ['nullable', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'enabled' => filter_var($this->input('enabled', true), FILTER_VALIDATE_BOOLEAN),
        ]);
    }
}
