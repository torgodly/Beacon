import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type SearchableComboboxOption = {
    value: string;
    label: string;
    description?: string;
};

type SearchableComboboxProps = {
    id?: string;
    name?: string;
    value: string;
    onValueChange: (value: string) => void;
    options: SearchableComboboxOption[];
    placeholder?: string;
    disabled?: boolean;
    loading?: boolean;
    mono?: boolean;
    className?: string;
    emptyMessage?: string;
};

export function SearchableCombobox({
    id,
    name,
    value,
    onValueChange,
    options,
    placeholder,
    disabled = false,
    loading = false,
    mono = false,
    className,
    emptyMessage = 'No matches',
}: SearchableComboboxProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(value);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setQuery(value);
    }, [value]);

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();

        if (needle === '') {
            return options.slice(0, 50);
        }

        return options
            .filter(
                (option) =>
                    option.label.toLowerCase().includes(needle) ||
                    option.value.toLowerCase().includes(needle),
            )
            .slice(0, 50);
    }, [options, query]);

    useEffect(() => {
        function handlePointerDown(event: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', handlePointerDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={cn('dropdown w-full', open && 'dropdown-open', className)}
        >
            <input
                id={id}
                name={name}
                type="text"
                value={query}
                autoComplete="off"
                spellCheck={false}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                    'input input-bordered w-full rounded-xl bg-base-100 text-base-content',
                    'h-11 min-h-11',
                    mono && 'font-mono text-sm tabular-nums',
                )}
                onFocus={() => setOpen(true)}
                onChange={(event) => {
                    const next = event.target.value;
                    setQuery(next);
                    onValueChange(next);
                    setOpen(true);
                }}
            />

            <ul className="dropdown-content menu z-[60] mt-1 max-h-56 w-full flex-nowrap overflow-y-auto rounded-2xl border border-base-300 bg-base-100 p-2 shadow-lg">
                {loading ? (
                    <li className="pointer-events-none">
                        <span className="text-base-content/70">Loading…</span>
                    </li>
                ) : filtered.length === 0 ? (
                    <li className="pointer-events-none">
                        <span className="text-base-content/70">
                            {emptyMessage}
                        </span>
                    </li>
                ) : (
                    filtered.map((option) => (
                        <li key={option.value}>
                            <button
                                type="button"
                                className={cn(
                                    option.value === value && 'active',
                                    mono && 'font-mono text-sm',
                                )}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    setQuery(option.label);
                                    onValueChange(option.value);
                                    setOpen(false);
                                }}
                            >
                                <span>{option.label}</span>
                                {option.description && (
                                    <span className="text-xs opacity-70">
                                        {option.description}
                                    </span>
                                )}
                            </button>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
}
