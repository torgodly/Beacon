/** Client-side validators aligned with Laravel FormRequest rules. */

const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9.-]{0,61}[a-z0-9])?$/;
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_]{1,64}$/;
const DATABASE_USERNAME_PATTERN = /^[A-Za-z0-9_]{1,32}$/;
const WEB_DIRECTORY_PATTERN = /^\/(?:[A-Za-z0-9._-]+\/?)*$/;
const BODY_SIZE_PATTERN = /^[0-9]{1,6}[kKmMgG]?$/;
const GITHUB_REPO_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
const GIT_URL_PATTERN = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/;
const SUPERVISOR_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/i;

export function normalizeHostname(value: string): string {
    return value.trim().toLowerCase();
}

export function hostnameError(value: string): string | undefined {
    const name = normalizeHostname(value);

    if (name === '') {
        return 'Enter a domain or hostname.';
    }

    if (name.length > 253) {
        return 'Hostname must be 253 characters or fewer.';
    }

    if (name.includes('..')) {
        return 'Hostname cannot contain consecutive dots.';
    }

    if (!HOSTNAME_PATTERN.test(name)) {
        return 'Enter a valid hostname (lowercase letters, numbers, dots, hyphens).';
    }

    if (!name.includes('.')) {
        return 'Enter a full domain name (e.g. app.example.com).';
    }

    const labels = name.split('.');

    for (const label of labels) {
        if (label.length === 0) {
            return 'Domain labels cannot be empty.';
        }

        if (label.length > 63) {
            return 'Each domain label must be 63 characters or fewer.';
        }

        if (label.startsWith('-') || label.endsWith('-')) {
            return 'Domain labels cannot start or end with a hyphen.';
        }
    }

    const tld = labels[labels.length - 1] ?? '';

    if (tld.length < 2) {
        return 'Enter a valid top-level domain.';
    }

    return undefined;
}

export function databaseNameError(value: string): string | undefined {
    const name = value.trim();

    if (name === '') {
        return 'Enter a database name.';
    }

    if (name.length > 64) {
        return 'Database name must be 64 characters or fewer.';
    }

    if (!DATABASE_NAME_PATTERN.test(name)) {
        return 'Database names may only contain letters, numbers, and underscores.';
    }

    return undefined;
}

export function databaseUsernameError(value: string): string | undefined {
    const username = value.trim();

    if (username === '') {
        return 'Enter a username.';
    }

    if (username.length > 32) {
        return 'Username must be 32 characters or fewer.';
    }

    if (!DATABASE_USERNAME_PATTERN.test(username)) {
        return 'Usernames may only contain letters, numbers, and underscores.';
    }

    return undefined;
}

export function webDirectoryError(value: string): string | undefined {
    const trimmed = value.trim();

    if (trimmed === '') {
        return undefined;
    }

    let directory = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

    if (directory !== '/') {
        directory = directory.replace(/\/+$/, '');
    }

    if (directory.includes('..')) {
        return 'Document root cannot contain ..';
    }

    if (directory.length > 64) {
        return 'Document root must be 64 characters or fewer.';
    }

    if (!WEB_DIRECTORY_PATTERN.test(directory)) {
        return 'Enter a path like /public or /dist.';
    }

    return undefined;
}

export function bodySizeError(value: string): string | undefined {
    const trimmed = value.trim();

    if (trimmed === '') {
        return undefined;
    }

    if (trimmed.length > 12) {
        return 'Max upload size must be 12 characters or fewer.';
    }

    if (!BODY_SIZE_PATTERN.test(trimmed)) {
        return 'Use nginx size syntax such as 100M, 512k, or 1G.';
    }

    return undefined;
}

export function repositoryError(value: string): string | undefined {
    const trimmed = value.trim();

    if (trimmed === '') {
        return undefined;
    }

    if (trimmed.length > 500) {
        return 'Repository URL is too long.';
    }

    if (
        GITHUB_REPO_PATTERN.test(trimmed) ||
        GIT_URL_PATTERN.test(trimmed)
    ) {
        return undefined;
    }

    return 'Enter owner/repo or a full Git HTTPS or SSH URL.';
}

export function branchError(
    branch: string,
    repository: string,
): string | undefined {
    if (repository.trim() === '') {
        return undefined;
    }

    const trimmed = branch.trim();

    if (trimmed === '') {
        return 'Enter or select a branch.';
    }

    if (trimmed.length > 255) {
        return 'Branch name must be 255 characters or fewer.';
    }

    return undefined;
}

export function supervisorProcessNameError(value: string): string | undefined {
    const name = value.trim();

    if (name === '') {
        return 'Enter a process name.';
    }

    if (name.length > 64) {
        return 'Process name must be 64 characters or fewer.';
    }

    if (!SUPERVISOR_NAME_PATTERN.test(name)) {
        return 'Use lowercase letters, numbers, and hyphens.';
    }

    return undefined;
}

export function requiredTextError(
    value: string,
    label: string,
    maxLength: number,
): string | undefined {
    const trimmed = value.trim();

    if (trimmed === '') {
        return `Enter ${label}.`;
    }

    if (trimmed.length > maxLength) {
        return `${label.charAt(0).toUpperCase()}${label.slice(1)} must be ${maxLength} characters or fewer.`;
    }

    return undefined;
}

export type FieldErrors = Record<string, string>;

export function firstError(errors: FieldErrors): string | undefined {
    return Object.values(errors)[0];
}

export function hasErrors(errors: FieldErrors): boolean {
    return Object.keys(errors).length > 0;
}
