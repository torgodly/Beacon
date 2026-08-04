import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPortalContainer } from '@/lib/portal-container';
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
    /** Render the menu in a portal so it is not clipped by modal overflow. */
    portalled?: boolean;
};

function ComboboxMenu({
    loading,
    filtered,
    emptyMessage,
    value,
    mono,
    selectOption,
    className,
    style,
    menuRef,
}: {
    loading: boolean;
    filtered: SearchableComboboxOption[];
    emptyMessage: string;
    value: string;
    mono: boolean;
    selectOption: (option: SearchableComboboxOption) => void;
    className?: string;
    style?: React.CSSProperties;
    menuRef?: React.RefObject<HTMLUListElement | null>;
}) {
    return (
        <ul
            ref={menuRef}
            className={className}
            style={style}
            role="listbox"
        >
            {loading ? (
                <li className="pointer-events-none px-0.5 py-1">
                    <span className="block rounded-md px-2 py-2 text-sm text-base-content/70">
                        Loading…
                    </span>
                </li>
            ) : filtered.length === 0 ? (
                <li className="pointer-events-none px-0.5 py-1">
                    <span className="block rounded-md px-2 py-2 text-sm text-base-content/70">
                        {emptyMessage}
                    </span>
                </li>
            ) : (
                filtered.map((option) => (
                    <li key={option.value} className="px-0.5 py-0.5">
                        <button
                            type="button"
                            role="option"
                            aria-selected={option.value === value}
                            className={cn(
                                'flex w-full flex-col items-start rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-base-200 focus:bg-base-200 focus:outline-none',
                                option.value === value &&
                                    'bg-primary/10 text-base-content',
                                mono && 'font-mono',
                            )}
                            onMouseDown={(event) => {
                                event.preventDefault();
                            }}
                            onClick={() => selectOption(option)}
                        >
                            <span>{option.label}</span>
                            {option.description ? (
                                <span className="text-xs text-base-content/60">
                                    {option.description}
                                </span>
                            ) : null}
                        </button>
                    </li>
                ))
            )}
        </ul>
    );
}

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
    portalled = false,
}: SearchableComboboxProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(value);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLUListElement>(null);

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

    function updateMenuPosition(): void {
        const input = inputRef.current;

        if (!input) {
            return;
        }

        const rect = input.getBoundingClientRect();

        setMenuStyle({
            position: 'fixed',
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 100,
        });
    }

    useEffect(() => {
        if (!open || !portalled) {
            return;
        }

        updateMenuPosition();

        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);

        return () => {
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [open, portalled, query]);

    useEffect(() => {
        function handlePointerDown(event: MouseEvent) {
            const target = event.target as Node;

            if (containerRef.current?.contains(target)) {
                return;
            }

            if (menuRef.current?.contains(target)) {
                return;
            }

            setOpen(false);
        }

        document.addEventListener('mousedown', handlePointerDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
        };
    }, []);

    function selectOption(option: SearchableComboboxOption) {
        setQuery(option.label);
        onValueChange(option.value);
        setOpen(false);
        inputRef.current?.blur();
    }

    const menuClassName = cn(
        'max-h-56 overflow-y-auto rounded-md border border-base-300 bg-base-100 p-1 shadow-lg',
        !portalled && 'dropdown-content menu mt-1 w-full z-[60]',
    );

    const menu = open ? (
        <ComboboxMenu
            loading={loading}
            filtered={filtered}
            emptyMessage={emptyMessage}
            value={value}
            mono={mono}
            selectOption={selectOption}
            className={menuClassName}
            style={portalled ? menuStyle : undefined}
            menuRef={menuRef}
        />
    ) : null;

    return (
        <>
            <div
                ref={containerRef}
                className={cn(
                    'relative w-full',
                    !portalled && 'dropdown',
                    !portalled && open && 'dropdown-open',
                    className,
                )}
            >
                <input
                    ref={inputRef}
                    id={id}
                    name={name}
                    type="text"
                    value={query}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        'bc-control',
                        mono && 'font-mono tabular-nums',
                        open && 'outline-2 -outline-offset-2 outline-primary',
                    )}
                    onFocus={() => setOpen(true)}
                    onChange={(event) => {
                        const next = event.target.value;
                        setQuery(next);
                        onValueChange(next);
                        setOpen(true);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            setOpen(false);
                            inputRef.current?.blur();
                            return;
                        }

                        if (event.key === 'Enter') {
                            event.preventDefault();

                            if (open && filtered.length > 0) {
                                selectOption(filtered[0]);
                            }
                        }
                    }}
                />

                {!portalled ? menu : null}
            </div>

            {portalled && menu && typeof document !== 'undefined'
                ? createPortal(menu, getPortalContainer())
                : null}
        </>
    );
}
