// Shared UI wiring: theme toggle, nav active state, small helpers.
// (The Network settings panel was removed from the public UI — defaults live in config.js.)

// ---- Theme (init is also inlined in <head> to prevent flash) ----
export function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("certverify.theme", next);
}

export function wireChrome() {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) toggle.addEventListener("click", toggleTheme);

  // Highlight current nav link (works with or without the .html suffix).
  const here = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const target = (a.getAttribute("href") || "").replace(/\.html$/, "");
    if (target === here) a.classList.add("active");
  });
}

export function showAlert(el, kind, message) {
  el.className = `alert ${kind} show`;
  el.textContent = message;
}
export function hideAlert(el) {
  el.className = "alert";
  el.textContent = "";
}

export function setLoading(btn, loading, label) {
  if (loading) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${label || "Working…"}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
