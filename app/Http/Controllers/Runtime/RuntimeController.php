<?php

namespace App\Http\Controllers\Runtime;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdatePackageManagerRequest;
use App\Models\NodeVersion;
use App\Models\Server;
use App\Services\Runtime\MemoryBudget;
use App\Services\Runtime\NodeService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class RuntimeController extends Controller
{
    public function index(NodeService $runtimes): Response
    {
        $server = Server::current();
        $runtimes->sync($server);

        return Inertia::render('runtimes/index', [
            'runtimes' => $runtimes->list($server),
            'supportedNode' => config('beacon.node_versions', []),
            'defaultNodeVersion' => $server->default_node_version,
            'defaultPackageManager' => $server->default_package_manager,
            'nodeHeapMb' => MemoryBudget::nodeHeapMb(),
        ]);
    }

    public function setDefault(NodeVersion $nodeVersion, NodeService $runtimes): RedirectResponse
    {
        $runtimes->setDefaultNode(Server::current(), $nodeVersion);

        return back()->with('toast', [
            'type' => 'success',
            'message' => "Node {$nodeVersion->version} is now the server default.",
        ]);
    }

    public function updatePackageManager(
        UpdatePackageManagerRequest $request,
        NodeService $runtimes,
    ): RedirectResponse {
        $runtimes->setDefaultPackageManager(
            Server::current(),
            $request->validated('package_manager'),
        );

        return back()->with('toast', [
            'type' => 'success',
            'message' => 'Default package manager updated.',
        ]);
    }
}
