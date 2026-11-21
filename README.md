# Focus Gate

A lightweight Manifest V3 extension for Chrome, Brave, and Edge.

## Features
- Always block a domain, with a switch to unblock it.
- Set a daily active-use allowance. Once used, the domain redirects until the local calendar day rolls over.
- Redirect blocked top-level navigations to a random URL from the configured pool.

Daily use counts only while the domain is the active tab and its browser window has focus. Time is sampled once per minute, and the service worker caps each missed sample at 90 seconds. Data stays in `chrome.storage.local`.

## Load in a Chromium browser
1. Open the browser's extensions page (`chrome://extensions` or `edge://extensions`).
2. Turn on Developer mode.
3. Choose **Load unpacked** and select this folder.
4. Click the Focus Gate toolbar button to open its settings in a full browser tab. Destination pool changes save automatically as you type, and the Save button remains available.

The extension requests `webNavigation` to update active-site tracking and `<all_urls>` host access so DNR rules can match user-entered domains. A fixed destination pool is provided as a starting point.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## Troubleshooting

The browser's extension error log can retain entries from earlier loads. Click **Clear all** in the extension error view, reload Focus Gate from the extensions page, and check whether the error returns before treating it as a current issue.
