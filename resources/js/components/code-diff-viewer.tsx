import ReactDiffViewer from 'react-diff-viewer-continued';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

export function CodeDiffViewer({
    oldValue,
    newValue,
    oldTitle = 'Current',
    newTitle = 'Incoming',
    className,
}: {
    oldValue: string;
    newValue: string;
    oldTitle?: string;
    newTitle?: string;
    className?: string;
}) {
    const { resolvedAppearance } = useAppearance();
    const isDark = resolvedAppearance === 'dark';

    return (
        <div
            className={cn(
                'max-h-[min(420px,50vh)] overflow-auto rounded-lg border',
                className,
            )}
        >
            <ReactDiffViewer
                oldValue={oldValue}
                newValue={newValue}
                splitView={false}
                useDarkTheme={isDark}
                leftTitle={oldTitle}
                rightTitle={newTitle}
                hideLineNumbers={false}
                styles={{
                    diffContainer: {
                        fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: '12px',
                    },
                    line: {
                        padding: '0 8px',
                    },
                    contentText: {
                        lineHeight: '1.5',
                    },
                }}
            />
        </div>
    );
}
