<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDatabaseRequest extends FormRequest
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
                'max:64',
                'regex:/^[A-Za-z0-9_]{1,64}$/',
                Rule::unique('databases', 'name'),
            ],
            'allow_remote' => ['sometimes', 'boolean'],
        ];
    }
}
