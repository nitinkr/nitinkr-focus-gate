const $ = s => document.querySelector(s);
let state = { sites: [], usage: {}, destinations: [] };
const fmt = seconds => `${Math.floor(seconds / 60)} min used`;
function render() {
  const root = $("#sites"); root.replaceChildren();
  if (!state.sites.length) root.innerHTML = '<p class="empty">No sites added yet.</p>';
  state.sites.forEach(site => {
    const row = document.createElement("article"); row.className = "site-row";
    const info = document.createElement("div");
    info.innerHTML = `<strong></strong><small></small>`;
    info.querySelector("strong").textContent = site.host;
    const used = state.usage[site.host] || 0;
    info.querySelector("small").textContent = site.mode === "limit" ? `${fmt(used)} of ${site.limitMinutes} min today` : "Always block";
    row.append(info);
    if (site.mode === "always") {
      const label = document.createElement("label"); label.className = "switch";
      const input = document.createElement("input"); input.type = "checkbox"; input.checked = site.blocked !== false;
      input.title = "Block this site"; input.addEventListener("change", async () => { site.blocked = input.checked; await persist(); });
      label.append(input, document.createElement("span")); row.append(label);
    } else {
      const badge = document.createElement("span"); badge.className = used >= site.limitMinutes * 60 ? "badge blocked" : "badge"; badge.textContent = used >= site.limitMinutes * 60 ? "Blocked" : "On"; row.append(badge);
    }
    const del = document.createElement("button"); del.className = "remove"; del.textContent = "×"; del.title = "Remove site";
    del.onclick = async () => { state.sites = state.sites.filter(s => s.host !== site.host); await persist(); }; row.append(del); root.append(row);
  });
  $("#destinations").value = state.destinations.join("\n");
}
async function persist(renderAfter = true) {
  state.destinations = $("#destinations").value.split("\n").map(x => x.trim()).filter(Boolean);
  $("#status").textContent = "Saving…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "saveState", sites: state.sites, destinations: state.destinations });
    $("#status").textContent = result?.ok ? "Saved" : `Could not save${result?.error ? `: ${result.error}` : ""}`;
  } catch (error) {
    $("#status").textContent = `Could not save: ${error.message || error}`;
  }
  if (renderAfter) render();
}
chrome.runtime.sendMessage({ type: "getState" }).then(data => {
  if (data?.ok === false) throw new Error(data.error || "Could not load settings");
  state = data; render();
}).catch(error => { $("#status").textContent = `Could not load settings: ${error.message || error}`; });
$("#mode").addEventListener("change", () => { $("#limit-wrap").hidden = $("#mode").value !== "limit"; });
$("#site-form").addEventListener("submit", async e => {
  e.preventDefault(); const host = $("#domain").value.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/^www\./, "");
  if (!host || state.sites.some(s => s.host === host)) { $("#status").textContent = "That site is already listed"; return; }
  state.sites.push({ host, mode: $("#mode").value, limitMinutes: Number($("#limit").value) || 30, blocked: true }); $("#domain").value = ""; await persist();
});
$("#save").addEventListener("click", persist);
let destinationSaveTimer;
$("#destinations").addEventListener("input", () => {
  clearTimeout(destinationSaveTimer);
  $("#status").textContent = "Changes pending…";
  destinationSaveTimer = setTimeout(() => persist(false), 350);
});
$("#destinations").addEventListener("blur", () => {
  clearTimeout(destinationSaveTimer);
  persist(false);
});
