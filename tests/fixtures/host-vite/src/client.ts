/** Fetches a StaticJS fragment at runtime and injects it, re-creating its scripts so they execute. */
async function injectFragment(url: string, slot: HTMLElement): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Cannot load ${url}: ${response.status}`);
    const template = document.createElement("template");
    template.innerHTML = await response.text();
    const scripts = [...template.content.querySelectorAll("script")];
    for (const script of scripts) script.remove();
    slot.append(template.content);
    for (const original of scripts) {
        const script = document.createElement("script");
        for (const {name, value} of original.attributes) script.setAttribute(name, value);
        script.textContent = original.textContent;
        slot.append(script);
    }
}

const status = document.querySelector<HTMLElement>("[data-testid=host-status]")!;
injectFragment("/app2/partials/greeting.html", document.getElementById("slot")!)
    .then(() => (status.textContent = "fragment-injected"))
    .catch((error) => (status.textContent = `error: ${error.message}`));
