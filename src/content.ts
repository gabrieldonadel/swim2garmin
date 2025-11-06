chrome.runtime.onMessage.addListener(
  (
    request: { action: string },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: { csrfToken: string | null }) => void
  ) => {
    if (request.action === "getToken") {
      const csrfToken = document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute("content");
      sendResponse({ csrfToken: csrfToken ?? null });
    }
  }
);
