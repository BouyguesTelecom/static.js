import { createElement, type ReactNode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { captureServerContent, ServerContentContext } from '../components/ServerContentContext.js';

const registrations = new Map<string, () => void>();

/**
 * Hydrate an explicitly opted-in, replaceable partial without reevaluating its module.
 * Returns a disposer for the observer and the current React root.
 */
export const hydratePartial = (
    rootId: string,
    dataId: string,
    render: (initialData: unknown) => ReactNode,
): (() => void) => {
    if (typeof document === 'undefined') return () => {};
    const existing = registrations.get(rootId);
    if (existing) return existing;

    let active: { container: HTMLElement; root: Root } | undefined;
    let stopped = false;
    const failed = new WeakSet<HTMLElement>();

    const mount = (container: HTMLElement, initialData: unknown) => {
        const snapshot = captureServerContent(container);
        active = {
            container,
            root: hydrateRoot(container, createElement(
                ServerContentContext.Provider,
                { value: snapshot },
                render(initialData),
            )),
        };
    };

    const reconcile = () => {
        if (stopped) return;
        if (active && !active.container.isConnected) {
            const removed = active;
            active = undefined;
            removed.root.unmount();
        }
        if (active) return;

        document.removeEventListener('DOMContentLoaded', reconcile);
        const container = document.getElementById(rootId);
        if (!container || failed.has(container)) return;

        // StaticJS emits data after the root. Never borrow another partial's JSON.
        let sibling = container.nextElementSibling;
        while (sibling && !sibling.id.startsWith('app-')) {
            if (sibling.id === dataId) {
                // Only a following node or document completion proves the data script is closed.
                if (document.readyState === 'loading' && !sibling.nextSibling) {
                    document.addEventListener('DOMContentLoaded', reconcile, { once: true });
                    return;
                }
                let initialData: unknown;
                try {
                    initialData = JSON.parse(sibling.textContent || '');
                } catch (error) {
                    failed.add(container);
                    console.error(`[StaticJS] Invalid initial data in #${dataId}`, error);
                    return;
                }
                mount(container, initialData);
                return;
            }
            if (sibling.matches('script[type="module"][src]')) {
                mount(container, { title: '' });
                return;
            }
            sibling = sibling.nextElementSibling;
        }
    };

    // Ancestors can also be replaced; observing the old root cannot detect its successor.
    const observer = new MutationObserver(reconcile);
    observer.observe(document, { childList: true, subtree: true });
    const dispose = () => {
        if (stopped) return;
        stopped = true;
        observer.disconnect();
        document.removeEventListener('DOMContentLoaded', reconcile);
        registrations.delete(rootId);
        active?.root.unmount();
        active = undefined;
    };
    registrations.set(rootId, dispose);
    reconcile();
    return dispose;
};
