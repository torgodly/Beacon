<?php

namespace App\Http\Controllers;

use App\Models\Operation;
use App\Support\OutputStream\LogTail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Feeds the global operations dock and its terminal modal.
 *
 * Both endpoints are deliberately JSON rather than Inertia: the dock lives
 * outside the page tree so it survives navigation, and re-rendering a whole
 * Inertia page once a second to append a few log bytes would be absurd.
 */
class OperationController extends Controller
{
    /** How many finished operations the dock keeps in its history list. */
    private const RECENT_LIMIT = 20;

    public function index(): JsonResponse
    {
        $operations = Operation::query()
            ->latest('id')
            ->limit(self::RECENT_LIMIT)
            ->get();

        return response()->json([
            'operations' => $operations
                ->map(fn (Operation $operation): array => $operation->toPayload())
                ->all(),
            'active' => $operations
                ->filter(fn (Operation $operation): bool => $operation->isActive())
                ->count(),
        ]);
    }

    /**
     * Byte-offset tail. The client sends the offset it left off at and gets
     * only what has been written since, so reconnecting after a navigation
     * or a page reload costs one request and loses nothing.
     */
    public function log(Request $request, Operation $operation): JsonResponse
    {
        $offset = max(0, (int) $request->query('offset', '0'));
        $tail = LogTail::read($operation->log_path, $offset);

        return response()->json([
            'operation' => $operation->toPayload(),
            'offset' => $tail['offset'],
            'chunk' => $tail['chunk'],
            'eof' => $tail['eof'],
        ]);
    }
}
