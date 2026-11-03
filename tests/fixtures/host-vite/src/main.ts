const status = document.querySelector<HTMLElement>("[data-testid=host-status]");
if (status) status.textContent = "vite-host-ready";
