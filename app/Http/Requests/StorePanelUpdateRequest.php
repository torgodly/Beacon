<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePanelUpdateRequest extends FormRequest
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
            'tag' => ['required', 'string', 'regex:/^v\d+\.\d+\.\d+$/'],
        ];
    }
}
