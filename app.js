const SUPABASE_URL = 'https://rrkfpzbixrhkrmabdtzt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJya2ZwemJpeHJoa3JtYWJkdHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzYzMzgsImV4cCI6MjA5Mzc1MjMzOH0.o0cctVyZfy7TNN518CNtBTErSNTQSBNN9O6fe2XSQP8';
const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Prefer': 'return=representation'
};

let todos = [];
let currentFilter = 'all';

const input = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const list = document.getElementById('todoList');
const itemCount = document.getElementById('itemCount');
const footer = document.getElementById('footer');
const clearBtn = document.getElementById('clearCompleted');

async function api(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: HEADERS,
    ...options
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function loadTodos() {
  setLoading(true);
  try {
    todos = await api('todos?order=created_at.desc');
  } catch (e) {
    showError('Veriler yüklenemedi: ' + e.message);
  } finally {
    setLoading(false);
    render();
  }
}

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
    li.dataset.id = todo.id;

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

async function addTodo() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.disabled = true;
  addBtn.disabled = true;
  try {
    const [created] = await api('todos', {
      method: 'POST',
      body: JSON.stringify({ text, done: false })
    });
    todos.unshift(created);
    render();
  } catch (e) {
    showError('Eklenemedi: ' + e.message);
    input.value = text;
  } finally {
    input.disabled = false;
    addBtn.disabled = false;
    input.focus();
  }
}

async function toggle(id, done) {
  const todo = todos.find(t => t.id === id);
  if (todo) todo.done = done;
  render();
  try {
    await api(`todos?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ done })
    });
  } catch (e) {
    if (todo) todo.done = !done;
    showError('Güncellenemedi: ' + e.message);
    render();
  }
}

async function remove(id) {
  todos = todos.filter(t => t.id !== id);
  render();
  try {
    await api(`todos?id=eq.${id}`, { method: 'DELETE' });
  } catch (e) {
    showError('Silinemedi: ' + e.message);
    await loadTodos();
  }
}

addBtn.addEventListener('click', addTodo);
input.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

clearBtn.addEventListener('click', async () => {
  const completedIds = todos.filter(t => t.done).map(t => t.id);
  if (!completedIds.length) return;
  todos = todos.filter(t => !t.done);
  render();
  try {
    await api(`todos?done=eq.true`, { method: 'DELETE' });
  } catch (e) {
    showError('Silinemedi: ' + e.message);
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

function setLoading(on) {
  list.innerHTML = on ? '<li class="loading">Yükleniyor...</li>' : '';
}

function showError(msg) {
  const el = document.createElement('div');
  el.className = 'error-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

loadTodos();
