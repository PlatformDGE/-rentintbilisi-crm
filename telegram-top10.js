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

  function pluralizeReposts(value) {
    const number = Math.abs(Number(value || 0));
    const mod100 = number % 100;
    const mod10 = number % 10;
    if (mod100 >= 11 && mod100 <= 14) return 'репостов';
    if (mod10 === 1) return 'репост';
    if (mod10 >= 2 && mod10 <= 4) return 'репоста';
    return 'репостов';
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
        ? `<img class="telegram-item-image" src="${escapeHtml(item.image)}" alt="" loading="lazy">`
        : '<div class="telegram-item-placeholder" aria-hidden="true">⌂</div>';
      const reposts = Number(item.daily_reposts || 0);
      return `<article class="telegram-item">
        <div class="telegram-rank">${index + 1}</div>
        ${photo}
        <div class="telegram-property">
          <div class="telegram-property-head"><strong>${escapeHtml(item.title || `Telegram-объект №${item.id}`)}</strong>${formatPrice(item.price) ? `<b>${escapeHtml(formatPrice(item.price))}</b>` : ''}</div>
          ${details(item) ? `<p>${details(item)}</p>` : ''}
          ${secondary ? `<p>${escapeHtml(secondary)}</p>` : ''}
        </div>
        <div class="telegram-stats">
          <strong class="telegram-reposts">↗ ${reposts.toLocaleString('ru-RU')} ${pluralizeReposts(reposts)}</strong>
          <a href="${escapeHtml(item.post_url)}" target="_blank" rel="noopener noreferrer">Открыть пост ↗</a>
        </div>
      </article>`;
    }).join('');
  }

  function periodCopy(payload) {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tbilisi' });
    if (payload.status === 'before_window') {
      return { title: 'Сегодняшний рейтинг начнётся в 10:00', period: '' };
    }
    if (payload.status === 'finished' && payload.date !== today) {
      return { title: 'Итог за вчера', period: '10:00–22:00' };
    }
    if (payload.status === 'finished') {
      return { title: 'Итог за сегодня по репостам', period: '10:00–22:00' };
    }
    return { title: 'Топ-10 объектов по репостам сегодня', period: 'Сегодня, 10:00–22:00' };
  }

  function updateHeader(container, payload) {
    const copy = periodCopy(payload);
    const title = container.querySelector('.telegram-panel-title');
    const period = container.querySelector('.telegram-panel-period');
    const notice = container.querySelector('.telegram-panel-notice');
    const updated = container.querySelector('.telegram-top10-updated');
    if (title) title.textContent = copy.title;
    if (period) period.textContent = copy.period;
    if (notice) notice.textContent = payload.baseline_created_late ? 'Отсчёт сегодня начат позже 10:00' : '';
    if (updated) {
      const date = new Date(payload.updated_at);
      updated.textContent = Number.isNaN(date.getTime()) ? '' : `Обновлено: ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tbilisi' })}`;
    }
  }

  function show(container, body) {
    const content = container.querySelector('.telegram-top10-content');
    if (content) content.innerHTML = body;
  }

  async function loadTelegramTop10() {
    const container = document.getElementById(containerId);
    if (!container) return;
    const currentRequest = ++requestNumber;
    show(container, '<div class="telegram-state">Загружаем данные Telegram…</div>');
    try {
      const response = await fetch(`telegram-top10.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (currentRequest !== requestNumber || !document.body.contains(container)) return;
      updateHeader(container, payload);
      const items = Array.isArray(payload.items)
        ? payload.items.slice().sort((a, b) => {
          const repostDifference = Number(b.daily_reposts || 0) - Number(a.daily_reposts || 0);
          if (repostDifference !== 0) return repostDifference;
          const totalDifference = Number(b.current_forwards || 0) - Number(a.current_forwards || 0);
          if (totalDifference !== 0) return totalDifference;
          return String(b.published_at || '').localeCompare(String(a.published_at || ''));
        }).slice(0, 10)
        : [];
      if (!items.length) {
        const emptyMessage = payload.status === 'before_window'
          ? 'Сегодняшний рейтинг начнётся в 10:00.'
          : 'За выбранный период объекты пока не появились.';
        show(container, `<div class="telegram-state">${escapeHtml(emptyMessage)}</div>`);
        return;
      }
      show(container, `<div class="telegram-list">${renderItems(items)}</div>`);
    } catch (error) {
      if (currentRequest !== requestNumber || !document.body.contains(container)) return;
      console.error('Telegram top 10 loading failed', error);
      show(container, '<div class="telegram-state telegram-state-error">Не удалось загрузить Telegram-аналитику. Попробуйте обновить данные.</div>');
    }
  }

  window.loadTelegramTop10 = loadTelegramTop10;
  if (document.getElementById(containerId)) loadTelegramTop10();
}());
