; ─── Managed by Beacon — do not edit by hand ───
[program:{{ $process->program_name }}]
command         = {{ $process->command }}
directory       = {{ $site->path }}
user            = beacon
numprocs        = 1
autostart       = true
autorestart     = true
startsecs       = 10
startretries    = 3
stopasgroup     = true
killasgroup     = true
stopsignal      = SIGTERM
stopwaitsecs    = 20
redirect_stderr = true
stdout_logfile  = {{ $process->log_path }}
stdout_logfile_maxbytes = 10MB
stdout_logfile_backups  = 3
environment     = HOME="/home/beacon",USER="beacon"
