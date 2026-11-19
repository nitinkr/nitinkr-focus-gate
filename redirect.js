const defaults = ["https://www.wikipedia.org/", "https://www.nationalgeographic.com/", "https://www.google.com/doodles", "https://www.gutenberg.org/"];
chrome.storage.local.get({ destinations: defaults }).then(({ destinations }) => {
  const pool = destinations?.length ? destinations : defaults;
  const go = () => { location.replace(pool[Math.floor(Math.random() * pool.length)]); };
  document.querySelector("#choose").addEventListener("click", go);
  go();
});
