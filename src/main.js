import './style.css';

const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const guestTokenKey = 'diaryGuestToken';
const sessionIdKey = 'diarySessionId';
const $ = (id) => document.getElementById(id);
let currentSession = null;
let busy = false;

const screens = ['diary', 'chat', 'complete'];

function setStatus(message = '', isError = false) {
  const node = $('app-status');
  node.textContent = message;
  node.classList.toggle('error', isError);
  node.hidden = !message;
}

function setBusy(value, label = '') {
  busy = value;
  document.body.classList.toggle('is-busy', value);
  document.querySelectorAll('button, input, textarea').forEach((element) => {
    element.disabled = value;
  });
  if (label) setStatus(label);
}

function showScreen(name) {
  screens.forEach((screen) => { $(`screen-${screen}`).hidden = screen !== name; });
  const activeIndex = screens.indexOf(name);
  document.querySelectorAll('.steps li').forEach((item, index) => {
    item.classList.toggle('active', index === activeIndex);
    item.classList.toggle('complete', index < activeIndex);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderMessages(messages) {
  const list = $('messages');
  list.replaceChildren();
  for (const item of messages) {
    const bubble = document.createElement('div');
    bubble.className = `message ${item.role === 'user' ? 'from-user' : 'from-agent'}`;
    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent = item.role === 'user' ? '나' : '내일을 함께 정하는 대화';
    const content = document.createElement('p');
    content.textContent = item.content;
    bubble.append(label, content);
    list.append(bubble);
  }
  list.scrollTop = list.scrollHeight;
}

function renderSession(session) {
  currentSession = session;
  localStorage.setItem(sessionIdKey, session.id);
  $('saved-diary').textContent = session.diary;
  $('plan-input').value = session.tasks || '';
  $('complete-diary').textContent = session.diary;
  $('complete-tasks').textContent = session.tasks || '';
  renderMessages(session.messages);
  showScreen(session.status === 'complete' ? 'complete' : 'chat');
}

async function api(path, options = {}, authenticated = true) {
  const token = localStorage.getItem(guestTokenKey);
  if (authenticated && !token) throw new Error('방문 정보를 만들지 못했습니다. 새로고침해 주세요.');
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let detail = '요청을 처리하지 못했습니다.';
    try {
      const body = await response.json();
      detail = typeof body.detail === 'string' ? body.detail : detail;
    } catch { /* Keep a useful default message. */ }
    throw new Error(detail);
  }
  return response.status === 204 ? null : response.json();
}

async function runAction(action, waitingText) {
  if (busy) return;
  setBusy(true, waitingText);
  try {
    await action();
    setStatus();
  } catch (error) {
    setStatus(error.message || '요청을 처리하지 못했습니다.', true);
  } finally {
    setBusy(false);
  }
}

async function refreshRecords() {
  const result = await api('/api/sessions');
  const list = $('recent-list');
  list.replaceChildren();
  $('recent-records').hidden = result.sessions.length === 0;
  for (const item of result.sessions) {
    const button = document.createElement('button');
    button.className = 'recent-item';
    button.type = 'button';
    const date = document.createElement('span');
    date.textContent = item.created_at
      ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(item.created_at))
      : '저장한 기록';
    const title = document.createElement('strong');
    title.textContent = item.diary_excerpt || '오늘의 일기';
    button.append(date, title);
    button.addEventListener('click', () => runAction(async () => {
      renderSession(await api(`/api/sessions/${item.id}`));
    }, '기록을 불러오고 있습니다…'));
    list.append(button);
  }
}

async function restoreSession() {
  const sessionId = localStorage.getItem(sessionIdKey);
  if (!sessionId) {
    showScreen('diary');
    await refreshRecords();
    return;
  }
  try {
    renderSession(await api(`/api/sessions/${sessionId}`));
  } catch {
    localStorage.removeItem(sessionIdKey);
    showScreen('diary');
    await refreshRecords();
  }
}

async function setupGuest() {
  setBusy(true, '기록을 준비하고 있습니다…');
  try {
    if (localStorage.getItem(guestTokenKey)) {
      try {
        await api('/api/auth/me');
      } catch {
        localStorage.removeItem(guestTokenKey);
        localStorage.removeItem(sessionIdKey);
      }
    }
    if (!localStorage.getItem(guestTokenKey)) {
      const result = await api('/api/auth/guest', { method: 'POST' }, false);
      localStorage.setItem(guestTokenKey, result.token);
    }
    await restoreSession();
    setStatus();
  } catch (error) {
    showScreen('diary');
    setStatus(error.message || '기록을 준비하지 못했습니다. 새로고침해 주세요.', true);
  } finally {
    setBusy(false);
  }
}

$('today-date').textContent = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date());
setupGuest();

$('diary-input').addEventListener('input', () => {
  $('diary-count').textContent = `${$('diary-input').value.length.toLocaleString('ko-KR')} / 10,000`;
});

$('diary-form').addEventListener('submit', (event) => {
  event.preventDefault();
  runAction(async () => {
    $('plan-input').value = '';
    const session = await api('/api/sessions', {
      method: 'POST', body: JSON.stringify({ diary: $('diary-input').value.trim() }),
    });
    renderSession(session);
  }, '일기를 저장하고 대화를 시작하고 있습니다…');
});

$('chat-form').addEventListener('submit', (event) => {
  event.preventDefault();
  runAction(async () => {
    const message = $('chat-input').value.trim();
    if (!message) return;
    const session = await api(`/api/sessions/${currentSession.id}/messages`, {
      method: 'POST', body: JSON.stringify({ message }),
    });
    $('chat-input').value = '';
    renderSession(session);
    $('chat-input').focus();
  }, '답변을 기다리고 있습니다…');
});

$('suggest-plan').addEventListener('click', () => runAction(async () => {
  const result = await api(`/api/sessions/${currentSession.id}/plan-suggestion`, { method: 'POST' });
  if (result.tasks.trim() === '아직 확정된 할 일이 없습니다.') {
    throw new Error('대화에서 확정된 할 일이 없습니다. 대화를 이어가거나 직접 입력해 주세요.');
  }
  $('plan-input').value = result.tasks;
  $('plan-input').focus();
}, '대화에서 할 일을 정리하고 있습니다…'));

$('save-plan').addEventListener('click', () => runAction(async () => {
  const tasks = $('plan-input').value.trim();
  if (!tasks) throw new Error('내일 할 일을 입력하거나 대화에서 가져와 주세요.');
  const session = await api(`/api/sessions/${currentSession.id}/plan`, {
    method: 'POST', body: JSON.stringify({ tasks }),
  });
  renderSession(session);
}, '내일 할 일을 저장하고 있습니다…'));

$('back-to-chat').addEventListener('click', () => {
  showScreen('chat');
  $('plan-input').focus();
});

async function deleteCurrentSession() {
  if (!currentSession || !window.confirm('이 일기와 대화 기록을 삭제할까요?')) return;
  await runAction(async () => {
    await api(`/api/sessions/${currentSession.id}`, { method: 'DELETE' });
    localStorage.removeItem(sessionIdKey);
    currentSession = null;
    $('diary-input').value = '';
    $('diary-count').textContent = '0 / 10,000';
    $('plan-input').value = '';
    showScreen('diary');
    await refreshRecords();
  }, '기록을 삭제하고 있습니다…');
}
$('delete-chat').addEventListener('click', deleteCurrentSession);
$('delete-complete').addEventListener('click', deleteCurrentSession);
$('new-diary').addEventListener('click', () => runAction(async () => {
  localStorage.removeItem(sessionIdKey);
  currentSession = null;
  $('diary-input').value = '';
  $('diary-count').textContent = '0 / 10,000';
  $('plan-input').value = '';
  showScreen('diary');
  await refreshRecords();
}, '이전 기록을 불러오고 있습니다…'));
