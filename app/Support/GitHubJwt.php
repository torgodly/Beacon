<?php

namespace App\Support;

use RuntimeException;

class GitHubJwt
{
    public static function forApp(int $appId, string $privateKeyPem): string
    {
        $header = self::encode(['alg' => 'RS256', 'typ' => 'JWT']);
        $payload = self::encode([
            'iat' => time() - 60,
            'exp' => time() + 540,
            'iss' => (string) $appId,
        ]);

        $data = "{$header}.{$payload}";

        $key = openssl_pkey_get_private($privateKeyPem);

        if ($key === false) {
            throw new RuntimeException('Invalid GitHub App private key.');
        }

        $signed = '';

        if (! openssl_sign($data, $signed, $key, OPENSSL_ALGO_SHA256)) {
            throw new RuntimeException('Could not sign GitHub App JWT.');
        }

        return $data.'.'.self::base64UrlEncode($signed);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function encode(array $data): string
    {
        $json = json_encode($data, JSON_THROW_ON_ERROR);

        return self::base64UrlEncode($json);
    }

    private static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
