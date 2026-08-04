/**
 * Radix portals and custom menus must render inside an open `<dialog>` when
 * one is present. Native modal dialogs use the browser top layer, so content
 * portaled to `document.body` always appears behind the modal.
 */
export function getPortalContainer(): HTMLElement {
    if (typeof document === 'undefined') {
        return null as unknown as HTMLElement;
    }

    return (
        document.querySelector<HTMLElement>('dialog[open]') ?? document.body
    );
}
