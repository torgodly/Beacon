<?php

namespace App\Services\Ssl;

class CertificateParser
{
    /**
     * @return list<array{
     *     lineage: string,
     *     domains: list<string>,
     *     expiry: string|null,
     *     certificate_path: string|null,
     *     private_key_path: string|null,
     * }>
     */
    public static function parseCertbotCertificates(string $output): array
    {
        $certificates = [];
        $current = null;

        foreach (explode("\n", $output) as $line) {
            if (preg_match('/^\s*Certificate Name:\s*(.+)$/', $line, $matches)) {
                if ($current !== null) {
                    $certificates[] = $current;
                }

                $current = [
                    'lineage' => trim($matches[1]),
                    'domains' => [],
                    'expiry' => null,
                    'certificate_path' => null,
                    'private_key_path' => null,
                ];

                continue;
            }

            if ($current === null) {
                continue;
            }

            if (preg_match('/^\s*Domains:\s*(.+)$/', $line, $matches)) {
                $current['domains'] = array_values(array_filter(explode(' ', trim($matches[1]))));

                continue;
            }

            if (preg_match('/^\s*Expiry Date:\s*(.+?)(?:\s+\(|$)/', $line, $matches)) {
                $current['expiry'] = trim($matches[1]);

                continue;
            }

            if (preg_match('/^\s*Certificate Path:\s*(.+)$/', $line, $matches)) {
                $current['certificate_path'] = trim($matches[1]);

                continue;
            }

            if (preg_match('/^\s*Private Key Path:\s*(.+)$/', $line, $matches)) {
                $current['private_key_path'] = trim($matches[1]);
            }
        }

        if ($current !== null) {
            $certificates[] = $current;
        }

        return $certificates;
    }
}
