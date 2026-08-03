<?php

namespace App\Http\Requests;

use App\Models\NodeVersion;
use App\Models\Server;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSiteRuntimeRequest extends FormRequest
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
        $nodeVersions = NodeVersion::query()
            ->where('server_id', Server::current()->id)
            ->where('runtime', 'node')
            ->where('status', 'installed')
            ->pluck('version')
            ->all();

        return [
            'php_version' => ['nullable', 'string', Rule::in(config('beacon.php_versions', []))],
            'node_version' => ['nullable', 'string', Rule::in($nodeVersions)],
        ];
    }

    /**
     * @return array{php_version?: string|null, node_version?: string|null}
     */
    public function runtimeData(): array
    {
        /** @var array{php_version?: string|null, node_version?: string|null} */
        return $this->validated();
    }
}
