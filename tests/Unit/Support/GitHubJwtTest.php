<?php

namespace Tests\Unit\Support;

use App\Support\GitHubJwt;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class GitHubJwtTest extends TestCase
{
    #[Test]
    public function it_generates_a_three_part_jwt(): void
    {
        $privateKey = $this->samplePrivateKey();

        $jwt = GitHubJwt::forApp(123456, $privateKey);

        $this->assertMatchesRegularExpression(
            '/^[\w-]+\.[\w-]+\.[\w-]+$/',
            $jwt,
        );
    }

    private function samplePrivateKey(): string
    {
        $resource = openssl_pkey_new([
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
            'private_key_bits' => 2048,
        ]);

        openssl_pkey_export($resource, $privateKey);

        return $privateKey;
    }
}
