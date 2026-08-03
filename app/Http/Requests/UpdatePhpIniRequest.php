<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePhpIniRequest extends FormRequest
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
            'sapi' => ['required', Rule::in(['fpm', 'cli'])],
            'settings' => ['required', 'array'],
            'settings.*' => ['required', 'string', 'max:255'],
        ];
    }
}
