const SUPABASE_URL = 'https://rrkfpzbixrhkrmabdtzt.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJya2ZwemJpeHJoa3JtYWJkdHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzYzMzgsImV4cCI6MjA5Mzc1MjMzOH0.o0cctVyZfy7TNN518CNtBTErSNTQSBNN9O6fe2XSQP8';

// ── SESSION ──────────────────────────────────────────────
let session = JSON.parse(localStorage.getItem('sb_session') || 'null');
let pendingEmail = '';

function saveSession(s) {
  session = s;
  if (s) localStorage.setItem('sb_session', JSON.stringify(s));
  else localStorage.removeItem('sb_session');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${session ? session.access_token : ANON_KEY}`
  };
}

async function authFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.message || 'Hata');
  return data;
}

async function restFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...authHeaders(), 'Prefer': 'return=representation' },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'İstek başarısız');
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── SCREEN ROUTING ───────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function boot() {
  if (session) {
    showScreen('screen-app');
    loadTodos();
  } else {
    showScreen('screen-auth');
  }
}

// ── AUTH: TABS ────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
    clearErrors();
  });
});

function clearErrors() {
  document.querySelectorAll('.auth-error').forEach(el => el.textContent = '');
}

function setError(id, msg) {
  document.getElementById(id).textContent = msg;
}

// ── AUTH: REGISTER ────────────────────────────────────────
document.getElementById('form-register').addEventListener('submit', async e => {
  e.preventDefault();
  clearErrors();
  const email = document.getElementById('reg-email').value.trim();
  const pw = document.getElementById('reg-password').value;
  const pw2 = document.getElementById('reg-password2').value;

  if (pw !== pw2) return setError('reg-error', 'Şifreler eşleşmiyor.');

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Kayıt olunuyor...';
  try {
    await authFetch('signup', {
      method: 'POST',
      body: JSON.stringify({ email, password: pw })
    });
    pendingEmail = email;
    document.getElementById('otp-email-display').textContent = email;
    showScreen('screen-otp');
    document.querySelector('.otp-digit').focus();
  } catch (err) {
    setError('reg-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Kayıt Ol';
  }
});

// ── AUTH: LOGIN ───────────────────────────────────────────
document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  clearErrors();
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-password').value;

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Giriş yapılıyor...';
  try {
    const data = await authFetch('token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password: pw })
    });
    saveSession(data);
    showScreen('screen-app');
    loadTodos();
  } catch (err) {
    setError('login-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Giriş Yap';
  }
});

// ── OTP: INPUT BEHAVIOUR ──────────────────────────────────
const otpDigits = document.querySelectorAll('.otp-digit');

otpDigits.forEach((input, i) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(-1);
    input.classList.toggle('filled', input.value !== '');
    if (input.value && i < otpDigits.length - 1) otpDigits[i + 1].focus();
    if (getOtpValue().length === 6) document.getElementById('otp-submit').click();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !input.value && i > 0) {
      otpDigits[i - 1].value = '';
      otpDigits[i - 1].classList.remove('filled');
      otpDigits[i - 1].focus();
    }
  });

  input.addEventListener('paste', e => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    digits.split('').forEach((d, j) => {
      if (otpDigits[j]) {
        otpDigits[j].value = d;
        otpDigits[j].classList.add('filled');
      }
    });
    if (digits.length > 0) otpDigits[Math.min(digits.length, 5)].focus();
    if (digits.length === 6) document.getElementById('otp-submit').click();
  });
});

function getOtpValue() {
  return Array.from(otpDigits).map(i => i.value).join('');
}

function clearOtp() {
  otpDigits.forEach(i => { i.value = ''; i.classList.remove('filled'); });
  otpDigits[0].focus();
}

// ── OTP: VERIFY ───────────────────────────────────────────
document.getElementById('form-otp').addEventListener('submit', async e => {
  e.preventDefault();
  const token = getOtpValue();
  if (token.length < 6) return setError('otp-error', 'Lütfen 6 haneli kodu girin.');

  const btn = document.getElementById('otp-submit');
  btn.disabled = true;
  btn.textContent = 'Doğrulanıyor...';
  setError('otp-error', '');

  try {
    const data = await authFetch('verify', {
      method: 'POST',
      body: JSON.stringify({ email: pendingEmail, token, type: 'signup' })
    });
    saveSession(data);
    showScreen('screen-app');
    loadTodos();
  } catch (err) {
    setError('otp-error', 'Geçersiz veya süresi dolmuş kod.');
    clearOtp();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Doğrula';
  }
});

// ── OTP: RESEND ───────────────────────────────────────────
document.getElementById('otp-resend').addEventListener('click', async () => {
  const btn = document.getElementById('otp-resend');
  btn.disabled = true;
  btn.textContent = 'Gönderiliyor...';
  try {
    await authFetch('resend', {
      method: 'POST',
      body: JSON.stringify({ email: pendingEmail, type: 'signup' })
    });
    btn.textContent = 'Kod gönderildi!';
    setTimeout(() => { btn.textContent = 'Kodu tekrar gönder'; btn.disabled = false; }, 30000);
  } catch {
    btn.textContent = 'Kodu tekrar gönder';
    btn.disabled = false;
  }
});

// ── LOGOUT ────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await authFetch('logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': `Bearer ${session.access_token}` }
    });
  } catch {}
  saveSession(null);
  todos = [];
  showScreen('screen-auth');
});

// ── TODOS ─────────────────────────────────────────────────
let todos = [];
let currentFilter = 'all';

const todoInput = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const list = document.getElementById('todoList');
const itemCount = document.getElementById('itemCount');
const footer = document.getElementById('footer');
const clearBtn = document.getElementById('clearCompleted');

function getFiltered() {
  if (currentFilter === 'active') return todos.filter(t => !t.done);
  if (currentFilter === 'completed') return todos.filter(t => t.done);
  return todos;
}

function render() {
  const filtered = getFiltered();
  list.innerHTML = '';
  filtered.forEach(todo => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' completed' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = todo.done;
    cb.addEventListener('change', () => toggle(todo.id, !todo.done));

    const span = document.createElement('span');
    span.textContent = todo.text;

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '✕';
    del.addEventListener('click', () => remove(todo.id));

    li.append(cb, span, del);
    list.appendChild(li);
  });

  const active = todos.filter(t => !t.done).length;
  itemCount.textContent = `${active} görev kaldı`;
  footer.style.display = todos.length ? 'flex' : 'none';
}

async function loadTodos() {
  list.innerHTML = '<li class="loading">Yükleniyor...</li>';
  try {
    todos = await restFetch('todos?order=created_at.desc');
    render();
  } catch (err) {
    showToast('Veriler yüklenemedi: ' + err.message);
    list.innerHTML = '';
  }
}

async function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;
  todoInput.value = '';
  addBtn.disabled = true;
  try {
    const [created] = await restFetch('todos', {
      method: 'POST',
      body: JSON.stringify({ text, done: false, user_id: session.user.id })
    });
    todos.unshift(created);
    render();
  } catch (err) {
    showToast('Eklenemedi: ' + err.message);
    todoInput.value = text;
  } finally {
    addBtn.disabled = false;
    todoInput.focus();
  }
}

async function toggle(id, done) {
  const todo = todos.find(t => t.id === id);
  if (todo) todo.done = done;
  render();
  try {
    await restFetch(`todos?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ done })
    });
  } catch (err) {
    if (todo) todo.done = !done;
    render();
    showToast('Güncellenemedi');
  }
}

async function remove(id) {
  todos = todos.filter(t => t.id !== id);
  render();
  try {
    await restFetch(`todos?id=eq.${id}`, { method: 'DELETE' });
  } catch {
    showToast('Silinemedi');
    await loadTodos();
  }
}

addBtn.addEventListener('click', addTodo);
todoInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

clearBtn.addEventListener('click', async () => {
  if (!todos.some(t => t.done)) return;
  todos = todos.filter(t => !t.done);
  render();
  try {
    await restFetch('todos?done=eq.true', { method: 'DELETE' });
  } catch {
    showToast('Silinemedi');
    await loadTodos();
  }
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('.filter-btn.active').classList.remove('active');
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'error-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── START ─────────────────────────────────────────────────
boot();
