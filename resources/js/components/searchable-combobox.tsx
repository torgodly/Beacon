import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
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
        <div ref={containerRef} className={cn('relative', className)}>
            <Input
                id={id}
                name={name}
                value={query}
                mono={mono}
                autoComplete="off"
                spellCheck={false}
                placeholder={placeholder}
                disabled={disabled}
                onFocus={() => setOpen(true)}
                onChange={(event) => {
                    const next = event.target.value;
                    setQuery(next);
                    onValueChange(next);
                    setOpen(true);
                }}
            />

            {open && !disabled && (
                <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-[var(--bc-border-default)] bg-[var(--bc-bg-default)] shadow-lg">
                    {loading ? (
                        <p className="px-3 py-2 text-[13px] text-fg-muted">
                            Loading…
                        </p>
                    ) : filtered.length === 0 ? (
                        <p className="px-3 py-2 text-[13px] text-fg-muted">
                            {emptyMessage}
                        </p>
                    ) : (
                        <ul className="py-1">
                            {filtered.map((option) => (
                                <li key={option.value}>
                                    <button
                                        type="button"
                                        className={cn(
                                            'flex w-full flex-col items-start px-3 py-2 text-left text-[13px] hover:bg-[var(--bc-bg-subtle)]',
                                            option.value === value &&
                                                'bg-[var(--bc-bg-subtle)]',
                                        )}
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            setQuery(option.label);
                                            onValueChange(option.value);
                                            setOpen(false);
                                        }}
                                    >
                                        <span className="font-medium text-fg">
                                            {option.label}
                                        </span>
                                        {option.description && (
                                            <span className="text-fg-muted">
                                                {option.description}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
