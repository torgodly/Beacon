<?php

namespace App\Http\Controllers\Databases;

use App\Actions\Database\CreateDatabase;
use App\Actions\Database\CreateDatabaseUser;
use App\Actions\Database\DeleteDatabase;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDatabaseRequest;
use App\Http\Requests\StoreDatabaseUserRequest;
use App\Models\Database;
use App\Models\DatabaseBackup;
use App\Models\DatabaseUser;
use App\Models\Server;
use App\Services\Database\DatabaseBackupService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class DatabaseController extends Controller
{
    public function index(DatabaseBackupService $backups): Response
    {
        $server = Server::current();

        $databases = Database::query()
            ->where('server_id', $server->id)
            ->with([
                'users:id,username,host',
                'backups' => fn ($query) => $query->latest()->limit(5),
            ])
            ->orderBy('name')
            ->get()
            ->map(fn (Database $database): array => [
                'id' => $database->id,
                'name' => $database->name,
                'status' => $database->status,
                'users' => $database->users->map(fn (DatabaseUser $user): array => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'privileges' => $user->pivot->privileges,
                ])->values()->all(),
                'backups' => $database->backups
                    ->map(fn (DatabaseBackup $backup): array => DatabaseBackupController::backupPayload($backup))
                    ->values()
                    ->all(),
                'connections' => $backups->connectionStrings($database),
            ]);

        return Inertia::render('databases/index', [
            'databases' => $databases,
        ]);
    }

    public function store(StoreDatabaseRequest $request, CreateDatabase $createDatabase): RedirectResponse
    {
        try {
            $createDatabase->handle(Server::current(), $request->validated('name'));
        } catch (RuntimeException $e) {
            return back()->withErrors(['name' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'Database created.']);
    }

    public function destroy(Database $database, DeleteDatabase $deleteDatabase): RedirectResponse
    {
        abort_unless($database->server_id === Server::current()->id, 404);

        try {
            $deleteDatabase->handle($database);
        } catch (RuntimeException $e) {
            return back()->withErrors(['database' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'Database deleted.']);
    }

    public function storeUser(
        StoreDatabaseUserRequest $request,
        CreateDatabaseUser $createDatabaseUser,
    ): RedirectResponse {
        $data = $request->validated();
        $database = isset($data['database_id'])
            ? Database::query()
                ->where('server_id', Server::current()->id)
                ->whereKey($data['database_id'])
                ->first()
            : null;

        if (isset($data['database_id']) && $database === null) {
            return back()->withErrors(['database_id' => 'That database could not be found on this server.']);
        }

        try {
            $result = $createDatabaseUser->handle(
                Server::current(),
                $data['username'],
                $database,
                $data['privileges'] ?? 'all',
            );
        } catch (RuntimeException $e) {
            return back()->withErrors(['username' => $e->getMessage()]);
        }

        return back()
            ->with('toast', ['type' => 'success', 'message' => 'Database user created.'])
            ->with('database_user_password', $result['password']);
    }
}
