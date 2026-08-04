<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDeployPollingRequest extends FormRequest
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
        $min = (int) config('beacon.deployments.min_poll_interval_seconds', 30);
        $max = (int) config('beacon.deployments.max_poll_interval_seconds', 3600);

        return [
            'deploy_poll_interval_seconds' => ['nullable', 'integer', "min:{$min}", "max:{$max}"],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->input('deploy_poll_interval_seconds') === '') {
            $this->merge(['deploy_poll_interval_seconds' => null]);
        }
    }
}
