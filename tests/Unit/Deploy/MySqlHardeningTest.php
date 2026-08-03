<?php

namespace Tests\Unit\Deploy;

use Tests\TestCase;

class MySqlHardeningTest extends TestCase
{
    public function test_mysql_cnf_disables_network_and_local_infile(): void
    {
        $contents = file_get_contents(base_path('deploy/mysql/99-beacon.cnf'));

        $this->assertIsString($contents);
        $this->assertStringContainsString('bind-address = 127.0.0.1', $contents);
        $this->assertStringContainsString('secure_file_priv', $contents);
        $this->assertStringContainsString('local_infile = OFF', $contents);
    }

    public function test_install_script_grants_do_not_include_dangerous_privileges(): void
    {
        $contents = file_get_contents(base_path('install.sh'));
        preg_match('/mysql --protocol=socket <<SQL\n(.*?)SQL/s', (string) $contents, $matches);

        $this->assertNotEmpty($matches[1] ?? null);
        $grants = $matches[1];

        $this->assertStringContainsString("CREATE USER IF NOT EXISTS 'beacon_admin'@'localhost'", $grants);
        $this->assertStringContainsString('BACKUP_ADMIN', $grants);
        $this->assertStringNotContainsString('GRANT ALL', $grants);
        $this->assertDoesNotMatchRegularExpression('/\bFILE\b/', $grants);
        $this->assertDoesNotMatchRegularExpression('/\bPROCESS\b/', $grants);
        $this->assertDoesNotMatchRegularExpression('/\bRELOAD\b/', $grants);
        $this->assertDoesNotMatchRegularExpression('/\bSUPER\b/', $grants);
        $this->assertDoesNotMatchRegularExpression('/\bSHUTDOWN\b/', $grants);
    }

    public function test_panel_env_template_reserves_mysql_password_placeholder(): void
    {
        $contents = file_get_contents(base_path('deploy/env/panel.env'));

        $this->assertIsString($contents);
        $this->assertStringContainsString('BEACON_MYSQL_PASSWORD=__MYSQL_PASSWORD__', $contents);
    }
}
