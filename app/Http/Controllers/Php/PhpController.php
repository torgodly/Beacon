<?php

namespace App\Http\Controllers\Php;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdatePhpIniRequest;
use App\Models\PhpExtension;
use App\Models\PhpVersion;
use App\Models\Server;
use App\Services\Php\PhpExtensionService;
use App\Services\Php\PhpIniService;
use App\Services\Php\PhpService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class PhpController extends Controller
{
    public function index(PhpService $php, PhpIniService $ini): Response
    {
        $server = Server::current();
        $php->sync($server);

        $versions = $php->list($server);

        return Inertia::render('php/index', [
            'versions' => $versions,
            'supported' => config('beacon.php_versions', []),
            'iniKeys' => config('beacon.php_ini.keys', []),
            'iniDefaults' => config('beacon.php_ini.defaults', []),
            'defaultPhpVersion' => $server->default_php_version,
        ]);
    }

    public function install(string $version, PhpService $php): RedirectResponse
    {
        try {
            $php->queueInstall(Server::current(), $version);
        } catch (RuntimeException $e) {
            return back()->withErrors(['php' => $e->getMessage()]);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => "PHP {$version} install queued.",
        ]);
    }

    public function destroy(PhpVersion $phpVersion, PhpService $php): RedirectResponse
    {
        abort_unless($phpVersion->server_id === Server::current()->id, 404);

        $php->queueRemove($phpVersion);

        return back()->with('toast', [
            'type' => 'success',
            'message' => "PHP {$phpVersion->version} removal queued.",
        ]);
    }

    public function setDefault(PhpVersion $phpVersion, PhpService $php): RedirectResponse
    {
        try {
            $php->setDefault(Server::current(), $phpVersion);
        } catch (RuntimeException $e) {
            return back()->withErrors(['php' => $e->getMessage()]);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => "PHP {$phpVersion->version} is now the server default.",
        ]);
    }

    public function enableExtension(
        PhpVersion $phpVersion,
        PhpExtension $extension,
        PhpExtensionService $extensions,
    ): RedirectResponse {
        abort_unless($phpVersion->server_id === Server::current()->id, 404);
        abort_unless($extension->php_version_id === $phpVersion->id, 404);

        try {
            $extensions->enable($extension);
        } catch (RuntimeException $e) {
            return back()->withErrors(['extension' => $e->getMessage()]);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => "{$extension->name} enabled.",
        ]);
    }

    public function disableExtension(
        PhpVersion $phpVersion,
        PhpExtension $extension,
        PhpExtensionService $extensions,
    ): RedirectResponse {
        abort_unless($phpVersion->server_id === Server::current()->id, 404);
        abort_unless($extension->php_version_id === $phpVersion->id, 404);

        try {
            $extensions->disable($extension);
        } catch (RuntimeException $e) {
            return back()->withErrors(['extension' => $e->getMessage()]);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => "{$extension->name} disabled.",
        ]);
    }

    public function updateIni(
        UpdatePhpIniRequest $request,
        PhpVersion $phpVersion,
        PhpIniService $ini,
    ): RedirectResponse {
        abort_unless($phpVersion->server_id === Server::current()->id, 404);

        $data = $request->validated();

        try {
            $ini->save($phpVersion, $data['sapi'], $data['settings']);
        } catch (RuntimeException $e) {
            return back()->withErrors(['ini' => $e->getMessage()]);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'PHP configuration saved.',
        ]);
    }
}
