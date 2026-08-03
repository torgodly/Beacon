{{-- resources/views/php/pool.blade.php --}}
; Managed by Beacon — regenerated on save. Manual edits will be overwritten.
[{{ $site->poolName() }}]
user  = {{ $site->system_user }}
group = www-data

listen       = /run/php/php{{ $site->php_version }}-fpm-{{ $site->poolName() }}.sock
listen.owner = beacon-panel
listen.group = www-data
listen.mode  = 0660

pm                       = ondemand
pm.max_children          = 20
pm.process_idle_timeout  = 10s
pm.max_requests          = 500

chdir = {{ $site->path }}

catch_workers_output    = yes
decorate_workers_output = no

php_admin_value[error_log]     = /var/log/beacon/sites/{{ $site->name }}-php-error.log
php_admin_flag[log_errors]     = on
php_admin_flag[display_errors] = off

php_admin_value[memory_limit]        = {{ $ini['memory_limit'] }}
php_admin_value[upload_max_filesize] = {{ $ini['upload_max_filesize'] }}
php_admin_value[post_max_size]       = {{ $ini['post_max_size'] }}
php_admin_value[max_execution_time]  = {{ $ini['max_execution_time'] }}

php_admin_value[sys_temp_dir]      = {{ $site->path }}/storage/tmp
php_admin_value[upload_tmp_dir]    = {{ $site->path }}/storage/tmp
php_admin_value[session.save_path] = {{ $site->path }}/storage/sessions
@if ($site->open_basedir)
php_admin_value[open_basedir] = {{ $site->path }}:/usr/share/php{{ $extraPaths }}
@endif
@if ($site->strict_functions)
php_admin_value[disable_functions] = exec,passthru,shell_exec,system,proc_open,popen
@endif
