<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Operating System Users
    |--------------------------------------------------------------------------
    |
    | Beacon splits privileges across two OS users. "beacon" owns every site
    | workload (FPM pools, deploys, cron, Supervisor, the Web Console) and
    | holds zero sudo entries. "beacon-panel" runs the panel itself and is
    | the only account granted sudo access to the root wrappers below.
    |
    */

    'site_user' => env('BEACON_SITE_USER', 'beacon'),

    'panel_user' => env('BEACON_PANEL_USER', 'beacon-panel'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Paths
    |--------------------------------------------------------------------------
    |
    | Canonical, absolute paths for everything Beacon manages on the host.
    | These are used by the ProcessRunner stack, site provisioning, and the
    | installer to keep every path reference in one place.
    |
    */

    'paths' => [
        'bin' => env('BEACON_BIN_PATH', '/opt/beacon/bin'),
        'panel_root' => env('BEACON_PANEL_ROOT', '/opt/beacon/panel'),
        'panel_current' => env('BEACON_PANEL_CURRENT', '/opt/beacon/panel/current'),
        'panel_shared' => env('BEACON_PANEL_SHARED', '/opt/beacon/panel/shared'),
        'sites_home' => env('BEACON_SITES_HOME', '/home/beacon'),
        'ssh_dir' => env('BEACON_SSH_DIR', '/home/beacon/.ssh'),
        'deploy_scripts' => env('BEACON_DEPLOY_SCRIPTS', '/home/beacon/.beacon/deploy'),
        'launchers' => env('BEACON_LAUNCHERS', '/home/beacon/.beacon/bin'),
        'log_root' => env('BEACON_LOG_ROOT', '/var/log/beacon'),
        'deployment_logs' => env('BEACON_DEPLOYMENT_LOGS', '/var/log/beacon/deployments'),
        'command_logs' => env('BEACON_COMMAND_LOGS', '/var/log/beacon/commands'),
        'operation_logs' => env('BEACON_OPERATION_LOGS', '/var/log/beacon/operations'),
        'database_backups' => env('BEACON_DATABASE_BACKUPS', '/var/log/beacon/backups'),
        'panel_update_logs' => env('BEACON_PANEL_UPDATE_LOGS', '/var/log/beacon/panel-updates'),
        'site_logs' => env('BEACON_SITE_LOGS', '/var/log/beacon/sites'),
        'acme_webroot' => env('BEACON_ACME_WEBROOT', '/var/www/beacon-acme'),
        'nginx_sites_available' => env('BEACON_NGINX_SITES_AVAILABLE', '/etc/nginx/sites-available'),
        'nginx_sites_enabled' => env('BEACON_NGINX_SITES_ENABLED', '/etc/nginx/sites-enabled'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Reverse Proxy Port Range
    |--------------------------------------------------------------------------
    |
    | Node/Bun SSR apps (Next.js, Nuxt) are proxied from Nginx to a local
    | port allocated from this range. PortAllocator picks the lowest free
    | port, guarded by a unique index and a live socket check.
    |
    */

    'port_range' => [
        'min' => (int) env('BEACON_PORT_RANGE_MIN', 3000),
        'max' => (int) env('BEACON_PORT_RANGE_MAX', 3999),
    ],

    /*
    |--------------------------------------------------------------------------
    | Allowed Systemd Units
    |--------------------------------------------------------------------------
    |
    | The Services widget and `beacon-service` root wrapper only ever accept
    | this fixed allow-list of unit names — never a free-form string.
    |
    */

    'allowed_units' => [
        'nginx',
        'mysql',
        'redis-server',
        'supervisor',
        'php8.1-fpm',
        'php8.2-fpm',
        'php8.3-fpm',
        'php8.4-fpm',
    ],

    /*
    |--------------------------------------------------------------------------
    | Supported PHP Versions
    |--------------------------------------------------------------------------
    */

    'php_versions' => ['8.1', '8.2', '8.3', '8.4'],

    'node_versions' => ['20', '22', '24'],

    'php_ini' => [
        'keys' => [
            'memory_limit',
            'upload_max_filesize',
            'post_max_size',
            'max_execution_time',
        ],
        'defaults' => [
            'memory_limit' => '256M',
            'upload_max_filesize' => '64M',
            'post_max_size' => '64M',
            'max_execution_time' => '60',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Site Provisioning Defaults
    |--------------------------------------------------------------------------
    */

    'sites' => [
        'default_php_version' => env('BEACON_DEFAULT_PHP_VERSION', '8.4'),
        'default_node_version' => env('BEACON_DEFAULT_NODE_VERSION', '22'),
        'default_package_manager' => env('BEACON_DEFAULT_PACKAGE_MANAGER', 'npm'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Web Console
    |--------------------------------------------------------------------------
    */

    'console' => [
        'timeout' => (int) env('BEACON_CONSOLE_TIMEOUT', 120),
    ],

    /*
    |--------------------------------------------------------------------------
    | Health Checks
    |--------------------------------------------------------------------------
    |
    | When strict mode is enabled (production installs), HealthCheckService
    | validates wrapper binaries, sudoers, swap, and disk in addition to Redis.
    |
    */

    'health' => [
        'strict' => (bool) env('BEACON_HEALTH_STRICT', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | Deployments
    |--------------------------------------------------------------------------
    */

    'deployments' => [
        'script_timeout' => (int) env('BEACON_DEPLOY_SCRIPT_TIMEOUT', 1800),
        'output_tail_kb' => (int) env('BEACON_DEPLOY_OUTPUT_TAIL_KB', 256),
        'default_poll_interval_seconds' => (int) env('BEACON_DEFAULT_POLL_INTERVAL_SECONDS', 60),
        'min_poll_interval_seconds' => 30,
        'max_poll_interval_seconds' => 3600,
    ],

    /*
    |--------------------------------------------------------------------------
    | TLS / Let's Encrypt
    |--------------------------------------------------------------------------
    */

    'ssl' => [
        'letsencrypt_email' => env('BEACON_LETSENCRYPT_EMAIL'),
        'auto_issue_on_deploy' => (bool) env('BEACON_SSL_AUTO_ISSUE_ON_DEPLOY', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | GitHub App
    |--------------------------------------------------------------------------
    */

    'github' => [
        'app_name' => env('BEACON_GITHUB_APP_NAME', 'Beacon Panel'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Panel Self-Update
    |--------------------------------------------------------------------------
    */

    'panel' => [
        'repo' => env('BEACON_PANEL_REPO', 'https://github.com/beacon-org/beacon.git'),
        'keep_releases' => (int) env('BEACON_PANEL_KEEP_RELEASES', 3),
    ],

    /*
    |--------------------------------------------------------------------------
    | Data Retention
    |--------------------------------------------------------------------------
    */

    'retention' => [
        'metrics_days' => (int) env('BEACON_RETENTION_METRICS_DAYS', 30),
        'deployments_days' => (int) env('BEACON_RETENTION_DEPLOYMENTS_DAYS', 90),
        'commands_days' => (int) env('BEACON_RETENTION_COMMANDS_DAYS', 30),
        'deliveries_days' => (int) env('BEACON_RETENTION_DELIVERIES_DAYS', 14),
        'panel_updates_days' => (int) env('BEACON_RETENTION_PANEL_UPDATES_DAYS', 90),
    ],
];
