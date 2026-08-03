<?php

namespace Database\Factories;

use App\Models\Site;
use App\Models\SupervisorProcess;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SupervisorProcess>
 */
class SupervisorProcessFactory extends Factory
{
    protected $model = SupervisorProcess::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->slug(2);

        return [
            'site_id' => Site::factory(),
            'name' => $name,
            'program_name' => 'example-com-'.$name,
            'kind' => 'queue_worker',
            'command' => '',
            'directory' => '/home/beacon/example.com',
            'run_as' => 'beacon',
            'numprocs' => 1,
            'autostart' => true,
            'autorestart' => true,
            'stop_wait_secs' => 3600,
            'stop_signal' => 'TERM',
            'connection' => 'redis',
            'queue' => 'default',
            'tries' => 3,
            'job_timeout' => 90,
            'sleep' => 3,
            'max_time' => 3600,
            'config_path' => '/etc/supervisor/conf.d/example-com-'.$name.'.conf',
            'log_path' => '/var/log/beacon/sites/example.com-'.$name.'.log',
            'status' => 'stopped',
        ];
    }
}
