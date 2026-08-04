<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSupervisorProcessRequest extends FormRequest
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
            'kind' => ['nullable', 'string', 'in:queue_worker,custom'],
            'name' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9][a-z0-9-]{0,62}$/i'],
            'command' => ['required_if:kind,custom', 'nullable', 'string', 'max:2000'],
            'connection' => ['nullable', 'string', 'max:64'],
            'queue' => ['nullable', 'string', 'max:128'],
            'numprocs' => ['nullable', 'integer', 'min:1', 'max:16'],
            'tries' => ['nullable', 'integer', 'min:1', 'max:10'],
            'job_timeout' => ['nullable', 'integer', 'min:30', 'max:3600'],
            'stop_wait_secs' => ['nullable', 'integer', 'min:90', 'max:7200'],
            'sleep' => ['nullable', 'integer', 'min:1', 'max:60'],
            'max_time' => ['nullable', 'integer', 'min:60', 'max:86400'],
            'backoff' => ['nullable', 'integer', 'min:0', 'max:3600'],
            'rest' => ['nullable', 'integer', 'min:0', 'max:3600'],
            'autostart' => ['nullable', 'boolean'],
            'autorestart' => ['nullable', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'autostart' => filter_var($this->input('autostart', true), FILTER_VALIDATE_BOOLEAN),
            'autorestart' => filter_var($this->input('autorestart', true), FILTER_VALIDATE_BOOLEAN),
        ]);
    }
}
