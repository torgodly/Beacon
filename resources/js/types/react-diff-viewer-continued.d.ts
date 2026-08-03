declare module 'react-diff-viewer-continued' {
    import type { CSSProperties, ReactNode } from 'react';

    export interface ReactDiffViewerProps {
        oldValue: string;
        newValue: string;
        splitView?: boolean;
        useDarkTheme?: boolean;
        leftTitle?: ReactNode;
        rightTitle?: ReactNode;
        hideLineNumbers?: boolean;
        styles?: Record<string, CSSProperties>;
    }

    export default function ReactDiffViewer(
        props: ReactDiffViewerProps,
    ): ReactNode;
}
