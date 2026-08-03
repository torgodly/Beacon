; ─── Managed by Beacon — do not edit by hand ───
; site: {{ $site->name }} ({{ $site->type }}) → 127.0.0.1:{{ $site->proxy_port }}
[program:{{ $process->program_name }}]
command         = {{ $process->command }}
directory       = {{ $site->path }}
user            = beacon
numprocs        = 1
autostart       = {{ $process->autostart ? 'true' : 'false' }}
autorestart     = {{ $process->autorestart ? 'true' : 'false' }}
startsecs       = 10
startretries    = 3
stopasgroup     = true
killasgroup     = true
stopsignal      = SIGTERM
stopwaitsecs    = {{ $process->stop_wait_secs }}
redirect_stderr = true
stdout_logfile  = {{ $process->log_path }}
stdout_logfile_maxbytes = 10MB
stdout_logfile_backups  = 3
environment     = HOME="/home/beacon",USER="beacon"
