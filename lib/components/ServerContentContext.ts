import { createContext } from 'react';

interface ServerElementData {
  id: string;
  attrs: Record<string, string>;
  innerHTML: string;
}

export interface ServerContentSnapshot {
  onlyById: Map<string, string>;
  onlyByOrder: string[];
  onlyIndex: number;
  elementsById: Map<string, ServerElementData & { orderIndex: number }>;
  elementsByOrder: ServerElementData[];
  consumed: Set<number>;
}

export const ServerContentContext = createContext<ServerContentSnapshot | null>(null);

// Capture before hydrateRoot schedules React work, not during a component render.
export const captureServerContent = (root: ParentNode): ServerContentSnapshot => {
  const snapshot: ServerContentSnapshot = {
    onlyById: new Map(),
    onlyByOrder: [],
    onlyIndex: 0,
    elementsById: new Map(),
    elementsByOrder: [],
    consumed: new Set(),
  };

  root.querySelectorAll('[data-server-only]').forEach(element => {
    if (element.id) snapshot.onlyById.set(element.id, element.innerHTML);
    if (!element.closest('[data-server-element]')) {
      snapshot.onlyByOrder.push(element.innerHTML);
    }
  });
  root.querySelectorAll('[data-server-element]').forEach((element, orderIndex) => {
    const attrs: Record<string, string> = {};
    for (const attribute of Array.from(element.attributes)) {
      attrs[attribute.name] = attribute.value;
    }
    const data = { id: element.id, attrs, innerHTML: element.innerHTML };
    snapshot.elementsByOrder.push(data);
    if (element.id) snapshot.elementsById.set(element.id, { ...data, orderIndex });
  });
  return snapshot;
};
