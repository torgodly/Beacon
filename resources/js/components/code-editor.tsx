import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type CodeEditorLanguage =
    'nginx' | 'bash' | 'env' | 'ini' | 'json' | 'text';

const CodeMirrorEditor = lazy(() => import('@/components/code-mirror-editor'));

function EditorSkeleton({
    rows = 16,
    className,
}: {
    rows?: number;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'overflow-hidden rounded-lg border bg-muted/20 p-3',
                className,
            )}
        >
            <div className="mb-3 flex gap-2">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-3 w-24" />
            </div>
            <div className="space-y-2">
                {Array.from({ length: rows }).map((_, index) => (
                    <Skeleton
                        key={index}
                        className="h-4"
                        style={{ width: `${Math.max(35, 100 - index * 4)}%` }}
                    />
                ))}
            </div>
        </div>
    );
}

export function CodeEditor({
    value,
    onChange,
    language = 'text',
    errorLine,
    readOnly = false,
    rows = 16,
    className,
}: {
    value: string;
    onChange?: (value: string) => void;
    language?: CodeEditorLanguage;
    placeholder?: string;
    /** 1-indexed line number to highlight as having an error. */
    errorLine?: number;
    readOnly?: boolean;
    rows?: number;
    className?: string;
}) {
    return (
        <Suspense
            fallback={<EditorSkeleton rows={rows} className={className} />}
        >
            <CodeMirrorEditor
                value={value}
                onChange={onChange}
                language={language}
                readOnly={readOnly}
                errorLine={errorLine}
                className={className}
            />
        </Suspense>
    );
}
