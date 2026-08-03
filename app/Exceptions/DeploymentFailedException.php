<?php

namespace App\Exceptions;

use RuntimeException;

class DeploymentFailedException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $exitCode = 1,
    ) {
        parent::__construct($message, $exitCode);
    }
}
