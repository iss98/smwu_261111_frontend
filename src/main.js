import './style.css';

const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const authTokenKey = 'diaryAuthToken';
const $ = (id) => document.getElementById(id);
let currentSession = null;
let busy = false;

const screens = ['email', 'diary', 'chat', 'preview', 'sent'];
const stepForScreen = { email: 'email', diary: 'diary', chat: 'chat', preview: 'preview', sent: 'preview' };

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
  if (!value && currentSession?.status === 'send_unknown') $('send-submit').disabled = true;
  if (label) setStatus(label);
}

function showScreen(name) {
  screens.forEach((screen) => { $(`screen-${screen}`).hidden = screen !== name; });
  const activeIndex = ['email', 'diary', 'chat', 'preview'].indexOf(stepForScreen[name]);
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
  localStorage.setItem('diarySessionId', session.id);
  $('saved-diary').textContent = session.diary;
  $('plan-input').value = session.tasks || $('plan-input').value;
  $('preview-email').textContent = session.email;
  $('sent-email').textContent = session.email;
  $('preview-body').textContent = session.email_body || '';
  renderMessages(session.messages);
  if (session.status === 'sent') showScreen('sent');
  else if (session.status === 'preview') showScreen('preview');
  else if (session.status === 'chat') showScreen('chat');
  else {
    showScreen('preview');
    setStatus('메일 발송 상태를 확인할 수 없습니다. 중복 발송을 막기 위해 다시 보내지 않습니다.', true);
    $('send-submit').disabled = true;
  }
}

async function api(path, options = {}, authenticated = true) {
  const token = sessionStorage.getItem(authTokenKey);
  if (authenticated && !token) throw new Error('이메일 확인이 필요합니다.');
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

async function restoreSession() {
  const sessionId = localStorage.getItem('diarySessionId');
  if (!sessionId) {
    showScreen('diary');
    return;
  }
  try {
    renderSession(await api(`/api/sessions/${sessionId}`));
  } catch {
    localStorage.removeItem('diarySessionId');
    showScreen('diary');
  }
}

function setAccount(email = '') {
  $('account-email').textContent = email;
  $('sign-out').hidden = !email;
}

async function setupAuth() {
  const loginToken = new URLSearchParams(window.location.hash.slice(1)).get('login_token');
  if (loginToken) {
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    sessionStorage.removeItem(authTokenKey);
    setAccount();
    showScreen('email');
    await runAction(async () => {
      const result = await api('/api/auth/verify-link', {
        method: 'POST', body: JSON.stringify({ token: loginToken }),
      }, false);
      sessionStorage.setItem(authTokenKey, result.token);
      setAccount(result.email);
      await restoreSession();
    }, '이메일을 확인하고 있습니다…');
    return;
  }
  if (!sessionStorage.getItem(authTokenKey)) {
    setAccount();
    showScreen('email');
    return;
  }
  try {
    const result = await api('/api/auth/me');
    setAccount(result.email);
    await restoreSession();
  } catch {
    sessionStorage.removeItem(authTokenKey);
    localStorage.removeItem('diarySessionId');
    setAccount();
    showScreen('email');
  }
}

$('today-date').textContent = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date());
setStatus();
setupAuth();

$('email-form').addEventListener('submit', (event) => {
  event.preventDefault();
  runAction(async () => {
    const email = $('email-input').value.trim();
    await api('/api/auth/request-link', {
      method: 'POST', body: JSON.stringify({ email }),
    }, false);
    $('email-help').textContent = `${email} 주소로 확인 링크를 보냈습니다. 메일을 열어 계속해 주세요.`;
  }, '확인 링크를 보내고 있습니다…');
});

$('sign-out').addEventListener('click', () => runAction(async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } finally {
    sessionStorage.removeItem(authTokenKey);
  }
  localStorage.removeItem('diarySessionId');
  currentSession = null;
  setAccount();
  showScreen('email');
}, '로그아웃하고 있습니다…'));

$('diary-input').addEventListener('input', () => {
  $('diary-count').textContent = `${$('diary-input').value.length.toLocaleString('ko-KR')} / 10,000`;
});

$('diary-form').addEventListener('submit', (event) => {
  event.preventDefault();
  runAction(async () => {
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

$('preview-submit').addEventListener('click', () => runAction(async () => {
  const tasks = $('plan-input').value.trim();
  if (!tasks) throw new Error('내일 할 일을 입력하거나 대화에서 가져와 주세요.');
  const session = await api(`/api/sessions/${currentSession.id}/preview`, {
    method: 'POST', body: JSON.stringify({ tasks }),
  });
  renderSession(session);
}, '메일 내용을 정리하고 있습니다…'));

$('back-to-chat').addEventListener('click', () => {
  showScreen('chat');
  $('plan-input').focus();
});

$('send-submit').addEventListener('click', () => runAction(async () => {
  try {
    const result = await api(`/api/sessions/${currentSession.id}/send`, { method: 'POST' });
    if (result.status === 'sent') {
      currentSession.status = 'sent';
      showScreen('sent');
    }
  } catch (error) {
    try { renderSession(await api(`/api/sessions/${currentSession.id}`)); } catch { /* Keep original error. */ }
    throw error;
  }
}, '메일을 보내고 있습니다…'));

async function deleteCurrentSession() {
  if (!currentSession || !window.confirm('이 일기와 대화 기록을 삭제할까요?')) return;
  await runAction(async () => {
    await api(`/api/sessions/${currentSession.id}`, { method: 'DELETE' });
    localStorage.removeItem('diarySessionId');
    currentSession = null;
    $('diary-input').value = '';
    $('plan-input').value = '';
    showScreen('diary');
  }, '기록을 삭제하고 있습니다…');
}
$('delete-chat').addEventListener('click', deleteCurrentSession);
$('delete-sent').addEventListener('click', deleteCurrentSession);
$('new-diary').addEventListener('click', () => {
  localStorage.removeItem('diarySessionId');
  currentSession = null;
  $('diary-input').value = '';
  $('plan-input').value = '';
  showScreen('diary');
});
