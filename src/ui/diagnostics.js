/**
 * A small panel listing character/animation problems in plain English.
 * Only shown with ?debug in the URL, never on its own (not while developing, not on the live
 * site, not on phones or computers). The same messages always go to the browser console.
 */
export function showCharacterReport(root, report, { force = false } = {}) {
  if (!force || !report.length) return; // force: ?debug is in the URL

  const worst = report.some((r) => r.level === 'error') ? 'error' : report.some((r) => r.level === 'warning') ? 'warning' : 'info';
  const heading = worst === 'error' ? 'Character needs attention' : worst === 'warning' ? 'Character check: a few notes' : 'Character check';

  root.innerHTML = `
    <div class="diag__head">
      <strong>${heading}</strong>
      <button type="button" class="diag__close" aria-label="Hide character check">×</button>
    </div>
    <ul class="diag__list">
      ${report
        .map(
          (r) => `<li class="diag__item diag__item--${r.level}">
            <span class="diag__tag">${r.level === 'error' ? 'Problem' : r.level === 'warning' ? 'Heads up' : 'Note'}</span>
            <p>${escapeHtml(r.text)}</p>
            ${r.fix ? `<p class="diag__fix">${escapeHtml(r.fix)}</p>` : ''}
          </li>`,
        )
        .join('')}
    </ul>
    <p class="diag__foot">Only shown with ?debug in the address. Details are also in the browser console.</p>`;
  root.dataset.level = worst;
  root.hidden = false;
  root.querySelector('.diag__close').addEventListener('click', () => (root.hidden = true));
  // tuck the info-only notice away after a while
  if (worst === 'info') setTimeout(() => root.classList.add('is-minimized'), 9000);
  root.addEventListener('click', () => root.classList.remove('is-minimized'));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
