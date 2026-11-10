// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// Card payment. Today this is a test checkout: nothing is charged and card numbers
// are never stored (only the last 4 digits). To go live, pay() opens the bank's
// hosted payment page instead (Bank of Georgia iPay / TBC Checkout / Flitt): the
// server creates an order for the rental and a pre-authorisation (hold) for the
// deposit, and the bank's callback marks the booking as paid. See
// docs/car-club/README.md.

export const PROVIDER = 'test';

const luhn = n => {
  const d = n.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let s = 0;
  for (let i = 0; i < d.length; i++) {
    let x = +d[d.length - 1 - i];
    if (i % 2) { x *= 2; if (x > 9) x -= 9; }
    s += x;
  }
  return s % 10 === 0;
};

export function pay({ amount, deposit, title, t, money }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `<form class="sheet form" novalidate>
      <div class="sheet-h"><b>${t('pay.title')}</b><button type="button" class="x" aria-label="${t('pay.close')}">×</button></div>
      <p class="test-flag">${t('pay.test')}</p>
      <p class="muted">${title}</p>
      <div class="quote">
        <div><span>${t('pay.charge')}</span><b>${money(amount)}</b></div>
        <div class="dep"><span>${t('pay.hold')}</span><b>${money(deposit)}</b></div>
      </div>
      <label>${t('pay.card')}<input name="card" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" required></label>
      <div class="row2">
        <label>${t('pay.exp')}<input name="exp" placeholder="MM/YY" autocomplete="cc-exp" required></label>
        <label>CVC<input name="cvc" inputmode="numeric" maxlength="4" autocomplete="cc-csc" required></label>
      </div>
      <p class="err" hidden></p>
      <button class="btn wide" type="submit">${t('pay.payBtn', money(amount))}</button>
      <p class="hint">${t('pay.note')}</p>
    </form>`;
    document.body.append(wrap);
    const form = wrap.querySelector('form');
    const err = wrap.querySelector('.err');
    const close = ok => { wrap.remove(); resolve(ok); };
    wrap.querySelector('.x').onclick = () => close({ ok: false });
    wrap.addEventListener('click', e => { if (e.target === wrap) close({ ok: false }); });
    form.card.addEventListener('input', () => { form.card.value = form.card.value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '); });
    form.card.focus();
    form.onsubmit = e => {
      e.preventDefault();
      const card = form.card.value.replace(/\D/g, '');
      const [mm, yy] = form.exp.value.split('/').map(s => +s);
      const expOk = mm >= 1 && mm <= 12 && yy >= 0 && new Date(2000 + yy, mm, 1) > new Date();
      const msg = !luhn(card) ? t('pay.badCard') : !expOk ? t('pay.badExp') : !/^\d{3,4}$/.test(form.cvc.value) ? t('pay.badCvc') : '';
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = t('pay.processing');
      setTimeout(() => close({ ok: true, provider: PROVIDER, ref: 'TEST-' + Date.now().toString(36).toUpperCase(), last4: card.slice(-4) }), 900);
    };
  });
}
