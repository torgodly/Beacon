<?php

namespace Tests\Unit\Services\Ssl;

use App\Services\Ssl\CertificateParser;
use PHPUnit\Framework\TestCase;

class CertificateParserTest extends TestCase
{
    public function test_parses_certbot_certificates_output(): void
    {
        $output = <<<'OUTPUT'
Found the following certs:
  Certificate Name: app.example.com
    Serial Number: abc
    Key Type: RSA
    Domains: app.example.com www.app.example.com
    Expiry Date: 2026-11-01 12:00:00+00:00 (VALID: 89 days)
    Certificate Path: /etc/letsencrypt/live/app.example.com/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/app.example.com/privkey.pem
OUTPUT;

        $parsed = CertificateParser::parseCertbotCertificates($output);

        $this->assertCount(1, $parsed);
        $this->assertSame('app.example.com', $parsed[0]['lineage']);
        $this->assertSame(['app.example.com', 'www.app.example.com'], $parsed[0]['domains']);
        $this->assertSame('2026-11-01 12:00:00+00:00', $parsed[0]['expiry']);
        $this->assertSame('/etc/letsencrypt/live/app.example.com/fullchain.pem', $parsed[0]['certificate_path']);
        $this->assertSame('/etc/letsencrypt/live/app.example.com/privkey.pem', $parsed[0]['private_key_path']);
    }

    public function test_returns_empty_list_for_blank_output(): void
    {
        $this->assertSame([], CertificateParser::parseCertbotCertificates(''));
    }
}
