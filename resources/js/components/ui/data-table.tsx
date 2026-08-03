import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Beacon Design System · Table
 *
 * Real <table>/<th scope> semantics — never a grid of divs for tabular data.
 *
 * Density is a per-table setting the user controls and Beacon remembers, not
 * a per-screen decision: an engineer on a 32-inch monitor and one on a
 * 13-inch laptop want different answers and neither is wrong. Rows are
 * 36 / 52 / 64 for dense / default / relaxed, where "default" here is the
 * system's `row-height-relaxed` per this project's comfortable selection.
 *
 * Row height never changes on hover — any layout shift in a table destroys
 * the ability to scan and click.
 */
export type TableDensity = 'dense' | 'default' | 'relaxed';

const ROW_HEIGHT: Record<TableDensity, string> = {
    dense: 'h-9', // 36
    default: 'h-13', // 52
    relaxed: 'h-16', // 64
};

const DensityContext = React.createContext<TableDensity>('default');

function DataTable({
    className,
    density = 'default',
    children,
    ...props
}: React.ComponentProps<'table'> & { density?: TableDensity }) {
    return (
        <DensityContext.Provider value={density}>
            {/* Wide tables scroll inside their own container so the page body
             * never scrolls horizontally. */}
            <div className="w-full overflow-x-auto">
                <table
                    data-slot="data-table"
                    data-density={density}
                    className={cn(
                        'w-full border-collapse text-left text-[14px] leading-5',
                        className,
                    )}
                    {...props}
                >
                    {children}
                </table>
            </div>
        </DensityContext.Provider>
    );
}

function TableHead({ className, ...props }: React.ComponentProps<'thead'>) {
    return (
        <thead
            data-slot="table-head"
            className={cn(
                'border-b border-[var(--bc-border-default)] bg-[var(--bc-bg-surface-sunken)]',
                className,
            )}
            {...props}
        />
    );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
    return <tbody data-slot="table-body" className={className} {...props} />;
}

function TableRow({
    className,
    interactive = false,
    selected = false,
    ...props
}: React.ComponentProps<'tr'> & {
    interactive?: boolean;
    selected?: boolean;
}) {
    const density = React.useContext(DensityContext);

    return (
        <tr
            data-slot="table-row"
            data-selected={selected || undefined}
            className={cn(
                ROW_HEIGHT[density],
                'border-b border-[var(--bc-border-subtle)] last:border-b-0',
                // Colour-only change on hover — never a height or padding
                // change, which would shift every row below it.
                interactive &&
                    'cursor-pointer transition-colors duration-[--bc-duration-fast] hover:bg-[var(--bc-bg-hover)]',
                // Row actions are revealed on hover but must stay in the tab
                // order and become visible on :focus-within.
                interactive && 'group/row focus-within:bg-[var(--bc-bg-hover)]',
                selected &&
                    'bg-selected hover:bg-selected data-[selected]:bg-selected',
                className,
            )}
            {...props}
        />
    );
}

function TableHeaderCell({
    className,
    numeric = false,
    ...props
}: React.ComponentProps<'th'> & { numeric?: boolean }) {
    return (
        <th
            // Real scope so screen readers can associate cells with headers.
            scope="col"
            data-slot="table-header-cell"
            className={cn(
                // label-sm 13/18/500, table cell padding = space-3
                'px-3 py-0 text-[13px] leading-[18px] font-medium text-fg-muted',
                'first:pl-6 last:pr-6',
                numeric && 'text-right tabular-nums',
                className,
            )}
            {...props}
        />
    );
}

function TableCell({
    className,
    numeric = false,
    ...props
}: React.ComponentProps<'td'> & { numeric?: boolean }) {
    return (
        <td
            data-slot="table-cell"
            className={cn(
                'px-3 py-0 align-middle text-fg',
                'first:pl-6 last:pr-6',
                // Proportional figures make a column of numbers optically
                // ragged, and a ragged column is a column nobody scans.
                numeric && 'text-right font-mono text-[13px] tabular-nums',
                className,
            )}
            {...props}
        />
    );
}

/**
 * Trailing cell for row actions. Actions fade in on hover but remain in the
 * tab order and become fully visible on keyboard focus — a hover-only action
 * is inaccessible.
 */
function TableActions({ className, ...props }: React.ComponentProps<'td'>) {
    return (
        <td
            data-slot="table-actions"
            className={cn(
                'px-3 py-0 pr-6 text-right align-middle',
                'opacity-0 transition-opacity duration-[--bc-duration-fast]',
                'group-hover/row:opacity-100 group-focus-within/row:opacity-100',
                className,
            )}
            {...props}
        />
    );
}

export {
    DataTable,
    TableHead,
    TableBody,
    TableRow,
    TableHeaderCell,
    TableCell,
    TableActions,
};
