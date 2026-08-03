<?php

namespace Tests\Feature\Console;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DoctorCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_doctor_passes_in_testing_environment(): void
    {
        $this->artisan('beacon:doctor')->assertSuccessful();
    }
}
