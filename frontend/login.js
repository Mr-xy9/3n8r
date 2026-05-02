// منطق تسجيل الدخول | Login page logic
(function () {
  console.log('[login] script loaded');

  function init() {
    const form = document.getElementById('login-form');
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    if (!form) {
      console.error('[login] form not found in DOM');
      return;
    }

    function showError(msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
    }

    // إذا كان عند المستخدم توكن صالح، تحقق منه قبل التحويل
    const token = auth.token();
    if (token) {
      api.me()
        .then(() => { location.href = 'dashboard.html'; })
        .catch(() => { auth.clear(); /* توكن غير صالح، ابقَ في صفحة الدخول */ });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      errEl.hidden = true;
      btn.disabled = true;
      btn.textContent = 'جارِ التحقق...';
      try {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        console.log('[login] submitting for', username);
        const res = await api.login(username, password);
        console.log('[login] success', res.user);
        auth.save(res);
        location.href = 'dashboard.html';
      } catch (err) {
        console.error('[login] failed:', err);
        showError(err.message || 'فشل تسجيل الدخول');
        btn.disabled = false;
        btn.textContent = 'تسجيل الدخول';
      }
      return false;
    });

    console.log('[login] handler attached');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
