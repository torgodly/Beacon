import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import {
    defaultHighlightStyle,
    StreamLanguage,
    syntaxHighlighting,
} from '@codemirror/language';
import { nginx } from '@codemirror/legacy-modes/mode/nginx';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import {
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
    keymap,
    lineNumbers,
} from '@codemirror/view';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { CodeEditorLanguage } from '@/components/code-editor';
import { cn } from '@/lib/utils';

function languageExtension(language: CodeEditorLanguage): Extension {
    switch (language) {
        case 'nginx':
            return StreamLanguage.define(nginx);
        case 'bash':
            return StreamLanguage.define(shell);
        case 'env':
            return StreamLanguage.define(properties);
        case 'ini':
            return StreamLanguage.define(properties);
        case 'json':
            return json();
        default:
            return [];
    }
}

export default function CodeMirrorEditor({
    value,
    onChange,
    language = 'text',
    readOnly = false,
    errorLine,
    className,
}: {
    value: string;
    onChange?: (value: string) => void;
    language?: CodeEditorLanguage;
    readOnly?: boolean;
    errorLine?: number;
    className?: string;
}) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const notifyChange = useEffectEvent((next: string) => {
        onChange?.(next);
    });

    useEffect(() => {
        const host = hostRef.current;

        if (!host) {
            return undefined;
        }

        const state = EditorState.create({
            doc: value,
            extensions: [
                lineNumbers(),
                highlightActiveLine(),
                highlightActiveLineGutter(),
                history(),
                keymap.of([...defaultKeymap, ...historyKeymap]),
                syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                languageExtension(language),
                EditorView.lineWrapping,
                EditorView.editable.of(!readOnly),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        notifyChange(update.state.doc.toString());
                    }
                }),
                EditorView.theme({
                    '&': {
                        backgroundColor: 'transparent',
                        fontSize: '0.875rem',
                    },
                    '.cm-scroller': {
                        fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        minHeight: '12rem',
                    },
                    '.cm-gutters': {
                        backgroundColor: 'var(--bc-bg-surface-sunken)',
                        borderRight: '1px solid var(--bc-border-default)',
                        color: 'var(--bc-fg-subtle)',
                    },
                    '.cm-activeLineGutter': {
                        backgroundColor: 'color-mix(in oklab, var(--bc-cyan-500) 12%, transparent)',
                    },
                    '.cm-activeLine': {
                        backgroundColor: 'color-mix(in oklab, var(--bc-cyan-500) 8%, transparent)',
                        boxShadow:
                            'inset 2px 0 0 color-mix(in oklab, var(--bc-cyan-500) 70%, transparent)',
                    },
                    '.cm-line': {
                        paddingLeft: '2px',
                        lineHeight: '1.6',
                    },
                    '.cm-content': {
                        padding: '0.75rem 0',
                    },
                    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground':
                        {
                            backgroundColor:
                                'color-mix(in oklab, var(--bc-cyan-500) 20%, transparent) !important',
                        },
                    ...(errorLine
                        ? {
                              [`.cm-line:nth-child(${errorLine})`]: {
                                  backgroundColor:
                                      'color-mix(in oklab, var(--bc-red-500) 12%, transparent)',
                              },
                          }
                        : {}),
                }),
            ],
        });

        const view = new EditorView({ state, parent: host });
        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
        // `value` is synced in a separate effect to avoid recreating the editor.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
    }, [errorLine, language, readOnly]);

    useEffect(() => {
        const view = viewRef.current;

        if (!view) {
            return;
        }

        const current = view.state.doc.toString();

        if (current === value) {
            return;
        }

        view.dispatch({
            changes: { from: 0, to: current.length, insert: value },
        });
    }, [value]);

    return (
        <div
            ref={hostRef}
            data-language={language}
            className={cn(
                'overflow-hidden rounded-xl border border-[#E8EEF3] bg-white text-[#1C2D3F] dark:border-[#263647] dark:bg-[#1C2D3F]/80',
                readOnly && 'opacity-80',
                className,
            )}
        />
    );
}
