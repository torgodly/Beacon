<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDatabaseUserRequest extends FormRequest
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
            'username' => [
                'required',
                'string',
                'max:32',
                'regex:/^[A-Za-z0-9_]{1,32}$/',
                Rule::unique('database_users', 'username')->where('host', 'localhost'),
            ],
            'database_id' => ['nullable', 'integer', Rule::exists('databases', 'id')],
            'privileges' => ['required_with:database_id', Rule::in(['all', 'readonly'])],
        ];
    }
}
