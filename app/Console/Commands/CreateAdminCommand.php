<?php

namespace App\Console\Commands;

use App\Actions\Fortify\CreateNewUser;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

use function Laravel\Prompts\confirm;
use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

#[Signature('beacon:create-admin {--name=} {--email=} {--password=} {--force : Create an admin even if one already exists}')]
#[Description('Create the single Beacon administrator account')]
class CreateAdminCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(CreateNewUser $creator): int
    {
        if (User::query()->exists() && ! $this->option('force') && ! $this->shouldProceedWithAdditionalAdmin()) {
            $this->components->warn('An administrator already exists. Re-run with --force to create another one.');

            return self::FAILURE;
        }

        $name = $this->option('name') ?: text(
            label: 'Administrator name',
            required: true,
        );

        $email = $this->option('email') ?: text(
            label: 'Administrator email',
            required: true,
            validate: fn (string $value): ?string => filter_var($value, FILTER_VALIDATE_EMAIL)
                ? null
                : 'Enter a valid email address.',
        );

        $password = $this->option('password') ?: password(
            label: 'Administrator password',
            required: true,
        );

        try {
            $user = $creator->create([
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'password_confirmation' => $password,
            ]);
        } catch (ValidationException $e) {
            foreach (Arr::flatten($e->errors()) as $message) {
                $this->components->error($message);
            }

            return self::FAILURE;
        }

        $user->forceFill(['email_verified_at' => now()])->save();

        $this->components->info("Administrator [{$user->email}] created successfully.");

        return self::SUCCESS;
    }

    /**
     * Determine whether to proceed when an administrator already exists.
     */
    private function shouldProceedWithAdditionalAdmin(): bool
    {
        if ($this->hasProvidedAllCredentials()) {
            return false;
        }

        if (! $this->input->isInteractive() || $this->option('no-interaction')) {
            return false;
        }

        return confirm(
            label: 'An administrator already exists. Create another one anyway?',
            default: false,
        );
    }

    /**
     * Whether every credential was passed via CLI options (non-interactive create attempt).
     */
    private function hasProvidedAllCredentials(): bool
    {
        return $this->option('name') !== null
            && $this->option('email') !== null
            && $this->option('password') !== null;
    }
}
