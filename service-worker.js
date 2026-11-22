const DEFAULTS = {
  sites: [],
  destinations: ["https://www.wikipedia.org/", "https://www.nationalgeographic.com/", "https://www.google.com/doodles", "https://www.gutenberg.org/"],
  usage: {},
  usageDay: dayKey()
};
const TICK = "usage-tick";
let ruleUpdateQueue = Promise.resolve();

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function normalizeHost(value) {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch { return ""; }
}
function isBlocked(site, usage) {
  if (site.mode === "always") return site.blocked !== false;
  if (site.mode === "limit") return (usage[site.host] || 0) >= Number(site.limitMinutes || 1) * 60;
  return false;
}
function syncRules() {
  const update = async () => {
    const data = await chrome.storage.local.get(DEFAULTS);
    const usage = data.usageDay === dayKey() ? data.usage : {};
    const sites = data.sites || [];
    const rules = sites.filter(s => s.host && isBlocked(s, usage)).map((s, i) => ({
      id: i + 1,
      priority: 1,
      action: { type: "redirect", redirect: { extensionPath: "/redirect.html" } },
      condition: { requestDomains: [s.host], resourceTypes: ["main_frame"] }
    }));
    const old = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old.map(r => r.id), addRules: rules });
  };
  // Browser events can trigger rule sync at nearly the same time. Queue them so
  // each update reads and removes the rules installed by the prior update.
  const next = ruleUpdateQueue.catch(() => {}).then(update);
  ruleUpdateQueue = next;
  return next;
}
async function activeSite() {
  const win = await chrome.windows.getLastFocused({ populate: true });
  if (!win || win.focused === false) return null;
  const tab = (win.tabs || []).find(t => t.active);
  if (!tab?.url) return null;
  const host = normalizeHost(tab.url);
  return host ? { host, tabId: tab.id } : null;
}
async function accountUsage() {
  const data = await chrome.storage.local.get(DEFAULTS);
  const today = dayKey();
  let usage = data.usageDay === today ? (data.usage || {}) : {};
  const state = await chrome.storage.local.get({ tracking: null });
  const now = Date.now();
  if (state.tracking?.host && state.tracking.lastAt) {
    const elapsed = Math.max(0, Math.min(90, Math.floor((now - state.tracking.lastAt) / 1000)));
    usage[state.tracking.host] = (usage[state.tracking.host] || 0) + elapsed;
  }
  const current = await activeSite();
  await chrome.storage.local.set({ usage, usageDay: today, tracking: current ? { ...current, lastAt: now } : null });
  await syncRules();
}
async function refreshTracking() { await accountUsage(); }
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null);
  await chrome.storage.local.set({ ...DEFAULTS, ...existing });
  chrome.alarms.create(TICK, { periodInMinutes: 1 });
  await syncRules();
});
chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create(TICK, { periodInMinutes: 1 });
  await refreshTracking();
  await syncRules();
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === TICK) refreshTracking(); });
chrome.tabs.onActivated.addListener(refreshTracking);
chrome.tabs.onUpdated.addListener((id, change, tab) => { if (change.url || change.status === "complete") refreshTracking(); });
chrome.windows.onFocusChanged.addListener(refreshTracking);
chrome.webNavigation.onCommitted.addListener(details => { if (details.frameId === 0) refreshTracking(); });
chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && (changes.sites || changes.usage || changes.destinations)) syncRules(); });

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === "getState") {
    chrome.storage.local.get(DEFAULTS).then(async data => {
      if (data.usageDay !== dayKey()) data = { ...data, usage: {}, usageDay: dayKey() };
      respond({ ...data, today: dayKey() });
    }).catch(error => {
      console.error("Could not read Focus Gate settings:", error);
      respond({ ok: false, error: error.message || String(error) });
    });
    return true;
  }
  if (msg.type === "saveState") {
    (async () => {
      try {
        const sites = (msg.sites || []).map(s => ({ ...s, host: normalizeHost(s.host) })).filter(s => s.host);
        const destinations = (msg.destinations || []).map(s => s.trim()).filter(s => { try { return new URL(s).protocol.startsWith("http"); } catch { return false; } });
        await chrome.storage.local.set({ sites, destinations: destinations.length ? destinations : DEFAULTS.destinations });
        await syncRules();
        respond({ ok: true });
      } catch (error) {
        console.error("Could not save Focus Gate settings:", error);
        respond({ ok: false, error: error.message || String(error) });
      }
    })();
    return true;
  }
  if (msg.type === "toggleSite") {
    (async () => {
      try {
        const data = await chrome.storage.local.get(DEFAULTS);
        const sites = data.sites.map(s => s.host === msg.host ? { ...s, blocked: !s.blocked } : s);
        await chrome.storage.local.set({ sites });
        await syncRules();
        respond({ ok: true });
      } catch (error) {
        console.error("Could not update Focus Gate site:", error);
        respond({ ok: false, error: error.message || String(error) });
      }
    })();
    return true;
  }
});
