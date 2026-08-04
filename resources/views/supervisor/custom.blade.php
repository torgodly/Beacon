; ─── Managed by Beacon — do not edit by hand ───
[program:{{ $process->program_name }}]
process_name    = %(program_name)s_%(process_num)02d
command         = {{ $process->command }}
directory       = {{ $site->path }}
user            = beacon
numprocs        = {{ $process->numprocs }}
autostart       = {{ $process->autostart ? 'true' : 'false' }}
autorestart     = {{ $process->autorestart ? 'true' : 'false' }}
startsecs       = 5
stopasgroup     = true
killasgroup     = true
stopsignal      = {{ $process->stop_signal }}
stopwaitsecs    = {{ $process->stop_wait_secs }}
redirect_stderr = true
stdout_logfile  = {{ $process->log_path }}
stdout_logfile_maxbytes = 10MB
stdout_logfile_backups  = 3
environment     = HOME="/home/beacon",USER="beacon"
