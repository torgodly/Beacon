<?php

namespace Database\Factories;

use App\Models\PanelUpdate;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PanelUpdate>
 */
class PanelUpdateFactory extends Factory
{
    protected $model = PanelUpdate::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $uuid = (string) Str::uuid();

        return [
            'uuid' => $uuid,
            'action' => 'deploy',
            'tag' => 'v1.0.0',
            'status' => 'success',
            'log_path' => storage_path("framework/testing/panel-updates/{$uuid}.log"),
            'error' => null,
            'exit_code' => 0,
            'started_at' => now()->subMinutes(5),
            'finished_at' => now()->subMinutes(4),
        ];
    }
}
