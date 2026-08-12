<?php

namespace App\Http\Controllers\Databases;

use App\Actions\Database\CreateDatabase;
use App\Actions\Database\CreateDatabaseUser;
use App\Actions\Database\DeleteDatabase;
use App\Actions\Database\DeleteDatabaseUser;
use App\Actions\Database\UpdateDatabaseAccess;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDatabaseRequest;
use App\Http\Requests\StoreDatabaseUserRequest;
use App\Http\Requests\UpdateDatabaseAccessRequest;
use App\Models\Database;
use App\Models\DatabaseBackup;
use App\Models\DatabaseUser;
use App\Models\Server;
use App\Models\Site;
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

        $linkedSites = Site::query()
            ->where('server_id', $server->id)
            ->whereNotNull('database_id')
            ->with('domains')
            ->orderBy('name')
            ->get();

        $sitesByDatabaseId = $linkedSites->groupBy('database_id');
        $sitesByUserId = $linkedSites
            ->whereNotNull('database_user_id')
            ->groupBy('database_user_id');

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
                'allow_remote' => (bool) $database->allow_remote,
                'sites' => ($sitesByDatabaseId[$database->id] ?? collect())
                    ->map(fn (Site $site): array => $this->siteLinkPayload($site))
                    ->values()
                    ->all(),
                'users' => $database->users->map(fn (DatabaseUser $user): array => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'host' => $user->host,
                    'privileges' => $user->pivot->privileges,
                    'sites' => ($sitesByUserId[$user->id] ?? collect())
                        ->map(fn (Site $site): array => $this->siteLinkPayload($site))
                        ->values()
                        ->all(),
                ])->values()->all(),
                'backups' => $database->backups
                    ->map(fn (DatabaseBackup $backup): array => DatabaseBackupController::backupPayload($backup))
                    ->values()
                    ->all(),
                'connections' => $backups->connectionStrings($database),
            ]);

        return Inertia::render('databases/index', [
            'databases' => $databases,
            'server' => [
                'public_ip' => $server->public_ip,
            ],
        ]);
    }

    public function store(StoreDatabaseRequest $request, CreateDatabase $createDatabase): RedirectResponse
    {
        try {
            $createDatabase->handle(
                Server::current(),
                $request->validated('name'),
                $request->boolean('allow_remote'),
            );
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

    public function updateAccess(
        Database $database,
        UpdateDatabaseAccessRequest $request,
        UpdateDatabaseAccess $updateDatabaseAccess,
    ): RedirectResponse {
        abort_unless($database->server_id === Server::current()->id, 404);

        try {
            $updateDatabaseAccess->handle($database, $request->boolean('allow_remote'));
        } catch (RuntimeException $e) {
            return back()->withErrors(['database' => $e->getMessage()]);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => $request->boolean('allow_remote')
                ? 'Remote database access enabled.'
                : 'Database is now local only.',
        ]);
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

    public function destroyUser(
        DatabaseUser $databaseUser,
        DeleteDatabaseUser $deleteDatabaseUser,
    ): RedirectResponse {
        abort_unless($databaseUser->server_id === Server::current()->id, 404);

        try {
            $deleteDatabaseUser->handle($databaseUser);
        } catch (RuntimeException $e) {
            return back()->withErrors(['database_user' => $e->getMessage()]);
        }

        return back()->with('toast', ['type' => 'success', 'message' => 'Database user deleted.']);
    }

    /**
     * @return array{id: int, name: string, type: string, primary_domain: string}
     */
    private function siteLinkPayload(Site $site): array
    {
        $primary = $site->domains->firstWhere('is_primary', true);

        return [
            'id' => $site->id,
            'name' => $site->name,
            'type' => $site->type,
            'primary_domain' => $primary?->domain ?? $site->name,
        ];
    }
}
