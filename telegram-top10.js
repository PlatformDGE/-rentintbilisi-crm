(function () {
  'use strict';

  const containerId = 'telegram-top10';
  let requestNumber = 0;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[character]);
  }

  function formatPrice(price) {
    return Number.isFinite(price) ? `$${price.toLocaleString('en-US')}` : '';
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function details(item) {
    return [
      Number.isFinite(item.area) ? `${item.area} м²` : '',
      Number.isFinite(item.rooms) ? `${item.rooms} ${item.rooms === 1 ? 'спальня' : 'спальни'}` : '',
      item.district || ''
    ].filter(Boolean).map(escapeHtml).join(' · ');
  }

  function renderItems(items) {
    return items.map((item, index) => {
      const secondary = [item.metro ? `Метро: ${item.metro}` : '', item.floor ? `Этаж: ${item.floor}` : ''].filter(Boolean).join(' · ');
      const photo = item.image
        ? `<img class="telegram-item-image" src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : '<div class="telegram-item-placeholder" aria-hidden="true">⌂</div>';
      return `<article class="telegram-item">
        <div class="telegram-rank">${index + 1}</div>
        ${photo}
        <div class="telegram-property">
          <div class="telegram-property-head"><strong>${escapeHtml(item.title || `Telegram-объект №${item.id}`)}</strong>${formatPrice(item.price) ? `<b>${escapeHtml(formatPrice(item.price))}</b>` : ''}</div>
          ${details(item) ? `<p>${details(item)}</p>` : ''}
          ${secondary ? `<p>${escapeHtml(secondary)}</p>` : ''}
        </div>
        <div class="telegram-stats">
          <strong>👁 ${Number(item.views || 0).toLocaleString('ru-RU')}</strong>
          ${formatDate(item.published_at) ? `<span>${escapeHtml(formatDate(item.published_at))}</span>` : ''}
          <a href="${escapeHtml(item.post_url)}" target="_blank" rel="noopener noreferrer">Открыть пост ↗</a>
        </div>
      </article>`;
    }).join('');
  }

  function show(container, body, updatedAt) {
    const content = container.querySelector('.telegram-top10-content');
    const updated = container.querySelector('.telegram-top10-updated');
    if (content) content.innerHTML = body;
    if (updated) updated.textContent = updatedAt || '';
  }

  async function loadTelegramTop10() {
    const container = document.getElementById(containerId);
    if (!container) return;
    const currentRequest = ++requestNumber;
    show(container, '<div class="telegram-state">Загружаем данные Telegram…</div>', '');
    try {
      const response = await fetch(`telegram-top10.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (currentRequest !== requestNumber || !document.body.contains(container)) return;
      const items = Array.isArray(payload.items)
        ? payload.items.slice().sort((a, b) => Number(b.views || 0) - Number(a.views || 0)).slice(0, 10)
        : [];
      if (!items.length) {
        show(container, '<div class="telegram-state">Публикации пока не найдены.</div>', '');
        return;
      }
      const updatedAt = payload.updated_at ? `Обновлено: ${new Date(payload.updated_at).toLocaleString('ru-RU')}` : '';
      show(container, `<div class="telegram-list">${renderItems(items)}</div>`, updatedAt);
    } catch (error) {
      if (currentRequest !== requestNumber || !document.body.contains(container)) return;
      console.error('Telegram top 10 loading failed', error);
      show(container, '<div class="telegram-state telegram-state-error">Не удалось загрузить Telegram-аналитику. Попробуйте обновить данные.</div>', '');
    }
  }

  window.loadTelegramTop10 = loadTelegramTop10;
  if (document.getElementById(containerId)) loadTelegramTop10();
}());
