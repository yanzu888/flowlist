(() => {
  const core = window.FlowCore;
  const storageKey = 'flowlist.tasks.v1';
  const state = {
    tasks: loadTasks(),
    view: 'today',
    query: '',
    selectedDate: null,
    quickDateMode: 'today'
  };

  const elements = {
    taskList: document.querySelector('#taskList'),
    emptyState: document.querySelector('#emptyState'),
    emptyTitle: document.querySelector('#emptyTitle'),
    emptyCopy: document.querySelector('#emptyCopy'),
    viewTitle: document.querySelector('#viewTitle'),
    dateLine: document.querySelector('#dateLine'),
    stageMeta: document.querySelector('#stageMeta'),
    searchInput: document.querySelector('#searchInput'),
    quickEntryForm: document.querySelector('#quickEntryForm'),
    quickTitle: document.querySelector('#quickTitle'),
    quickDateLabel: document.querySelector('#quickDateLabel'),
    taskDialog: document.querySelector('#taskDialog'),
    taskForm: document.querySelector('#taskForm'),
    taskId: document.querySelector('#taskId'),
    taskTitle: document.querySelector('#taskTitle'),
    taskNotes: document.querySelector('#taskNotes'),
    taskDate: document.querySelector('#taskDate'),
    taskTime: document.querySelector('#taskTime'),
    taskReminder: document.querySelector('#taskReminder'),
    taskPriority: document.querySelector('#taskPriority'),
    dialogKicker: document.querySelector('#dialogKicker'),
    dialogTitle: document.querySelector('#dialogTitle'),
    deleteTaskButton: document.querySelector('#deleteTaskButton'),
    miniCalendar: document.querySelector('#miniCalendar'),
    calendarMonth: document.querySelector('#calendarMonth'),
    progressRing: document.querySelector('#progressRing'),
    progressPercent: document.querySelector('#progressPercent'),
    progressText: document.querySelector('#progressText'),
    progressDetail: document.querySelector('#progressDetail'),
    nextReminder: document.querySelector('#nextReminder'),
    reminderStatus: document.querySelector('#reminderStatus'),
    testReminderButton: document.querySelector('#testReminderButton'),
    toastRegion: document.querySelector('#toastRegion'),
    liveClock: document.querySelector('#liveClock')
  };

  const viewLabels = {
    today: '今天',
    upcoming: '即将到来',
    all: '全部任务',
    completed: '已完成'
  };

  function loadTasks() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const localTasks = Array.isArray(stored) ? stored : [];
      const nativeTasks = window.flowlist?.getTasks?.();
      if (Array.isArray(nativeTasks) && nativeTasks.length) {
        const nativeById = new Map(nativeTasks.map((task) => [String(task.id), task]));
        const merged = localTasks.map((task) => nativeById.get(String(task.id)) || task);
        nativeTasks.forEach((task) => {
          if (!merged.some((item) => String(item.id) === String(task.id))) merged.push(task);
        });
        return merged.map(core.normalizeTask).filter((task) => task.title);
      }
      return localTasks.map(core.normalizeTask).filter((task) => task.title);
    } catch {
      return [];
    }
  }

  function saveTasks() {
    localStorage.setItem(storageKey, JSON.stringify(state.tasks));
    window.flowlist.syncTasks(state.tasks);
    refreshReminderStatus();
  }

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function toDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDateLabel(key) {
    if (key === 'no-date') return '未安排日期';
    const date = new Date(`${key}T12:00:00`);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (key === toDateInput(today)) return '今天';
    if (key === toDateInput(tomorrow)) return '明天';
    if (key === toDateInput(yesterday)) return '昨天';
    return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(date);
  }

  function formatTime(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  }

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = value;
    return node.innerHTML;
  }

  function filteredTasks() {
    if (state.view === 'date' && state.selectedDate) {
      const needle = state.query.trim().toLocaleLowerCase('zh-CN');
      return core.sortTasks(state.tasks.filter((task) => {
        const matchesDate = !task.completed && task.dueAt && core.dayKey(task.dueAt) === state.selectedDate;
        const matchesQuery = !needle || `${task.title} ${task.notes}`.toLocaleLowerCase('zh-CN').includes(needle);
        return matchesDate && matchesQuery;
      }));
    }
    return core.filterTasks(state.tasks, state.view, state.query);
  }

  function render() {
    renderHeader();
    renderCounts();
    renderTasks();
    renderProgress();
    renderCalendar();
    renderNextReminder();
    window.lucide.createIcons();
  }

  function renderHeader() {
    const today = new Date();
    elements.dateLine.textContent = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    }).format(today);
    elements.viewTitle.textContent = state.view === 'date'
      ? formatDateLabel(state.selectedDate)
      : viewLabels[state.view];
    const count = filteredTasks().length;
    elements.stageMeta.textContent = state.view === 'completed' ? `${count} 项已完成` : `${count} 项待处理`;
  }

  function renderCounts() {
    const today = core.dayKey(new Date());
    const open = state.tasks.filter((task) => !task.completed);
    document.querySelector('#todayCount').textContent = open.filter((task) => task.dueAt && core.dayKey(task.dueAt) === today).length;
    document.querySelector('#upcomingCount').textContent = open.filter((task) => task.dueAt && core.dayKey(task.dueAt) > today).length;
    document.querySelector('#allCount').textContent = open.length;
    document.querySelector('#completedCount').textContent = state.tasks.filter((task) => task.completed).length;

    document.querySelectorAll('.nav-item').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === state.view);
    });
  }

  function renderTasks() {
    const tasks = filteredTasks();
    const groups = core.groupTasks(tasks);
    const groupKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'no-date') return 1;
      if (b === 'no-date') return -1;
      return a.localeCompare(b);
    });
    const today = core.dayKey(new Date());

    elements.taskList.innerHTML = groupKeys.map((key) => {
      const isOverdue = key !== 'no-date' && key < today && state.view !== 'completed';
      const items = groups[key].map((task) => taskTemplate(task)).join('');
      return `
        <section class="task-group">
          <div class="group-heading ${isOverdue ? 'overdue' : ''}">
            <span>${isOverdue ? '已逾期 · ' : ''}${formatDateLabel(key)}</span>
            <span class="group-count">${groups[key].length}</span>
          </div>
          ${items}
        </section>`;
    }).join('');

    const isEmpty = tasks.length === 0;
    elements.emptyState.hidden = !isEmpty;
    if (isEmpty) {
      if (state.query) {
        elements.emptyTitle.textContent = '没有匹配的任务';
        elements.emptyCopy.textContent = '换一个关键词，或清空搜索后再试。';
      } else if (state.view === 'completed') {
        elements.emptyTitle.textContent = '还没有已完成任务';
        elements.emptyCopy.textContent = '完成的事项会保留在这里，方便之后回看。';
      } else {
        elements.emptyTitle.textContent = state.view === 'today' ? '今天已经清空' : '这里暂时是空的';
        elements.emptyCopy.textContent = '把下一件要做的事写下来，给它一个明确时间。';
      }
    }
  }

  function taskTemplate(task) {
    const hasTime = Boolean(task.dueAt);
    const overdue = hasTime && !task.completed && new Date(task.dueAt).getTime() < Date.now();
    const note = task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : '';
    const reminderIcon = task.reminderAt ? '<i data-lucide="bell"></i>' : '<i data-lucide="clock-3"></i>';
    return `
      <article class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
        <button class="complete-button" type="button" data-action="complete" aria-label="${task.completed ? '恢复任务' : '完成任务'}">
          <i data-lucide="check"></i>
        </button>
        <div class="task-copy" data-action="edit" tabindex="0" role="button" aria-label="编辑 ${escapeHtml(task.title)}">
          <div class="task-title">
            <span>${escapeHtml(task.title)}</span>
            <span class="priority-mark priority-${task.priority}" title="优先级"></span>
          </div>
          ${note}
        </div>
        <div class="task-time ${overdue ? 'overdue' : ''} ${hasTime ? '' : 'no-time'}">
          ${reminderIcon}<span>${hasTime ? formatTime(task.dueAt) : '未安排'}</span>
        </div>
        <button class="icon-button task-menu" type="button" data-action="edit" aria-label="编辑任务" title="编辑任务">
          <i data-lucide="more-horizontal"></i>
        </button>
      </article>`;
  }

  function renderProgress() {
    const today = core.dayKey(new Date());
    const todayTasks = state.tasks.filter((task) => task.dueAt && core.dayKey(task.dueAt) === today);
    const done = todayTasks.filter((task) => task.completed).length;
    const percent = todayTasks.length ? Math.round((done / todayTasks.length) * 100) : 0;
    elements.progressRing.style.setProperty('--progress', `${percent * 3.6}deg`);
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressText.textContent = percent === 100 ? '今天完成了' : percent > 0 ? '正在推进' : '尚未开始';
    elements.progressDetail.textContent = todayTasks.length ? `已完成 ${done} / ${todayTasks.length} 项` : '今天还没有任务';
  }

  function renderCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    elements.calendarMonth.textContent = `${year} 年 ${month + 1} 月`;
    const first = new Date(year, month, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - mondayOffset);
    const taskDates = new Set(state.tasks.filter((task) => !task.completed && task.dueAt).map((task) => core.dayKey(task.dueAt)));
    const headers = ['一', '二', '三', '四', '五', '六', '日'].map((day) => `<span class="calendar-cell header">${day}</span>`).join('');
    const cells = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = toDateInput(date);
      const classes = [
        'calendar-cell',
        date.getMonth() === month ? '' : 'outside',
        key === toDateInput(now) ? 'today' : '',
        taskDates.has(key) ? 'has-task' : ''
      ].filter(Boolean).join(' ');
      return `<button class="${classes}" type="button" data-calendar-date="${key}" aria-label="查看 ${key} 的任务">${date.getDate()}</button>`;
    }).join('');
    elements.miniCalendar.innerHTML = headers + cells;
  }

  function renderNextReminder() {
    const now = Date.now();
    const next = state.tasks
      .filter((task) => !task.completed && task.reminderAt && new Date(task.reminderAt).getTime() > now)
      .sort((a, b) => new Date(a.reminderAt) - new Date(b.reminderAt))[0];
    if (!next) {
      elements.nextReminder.innerHTML = '<i data-lucide="bell-off"></i><p>暂无已设置的提醒</p>';
      return;
    }
    const date = new Date(next.reminderAt);
    const label = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    elements.nextReminder.innerHTML = `<i data-lucide="bell"></i><p><strong>${escapeHtml(next.title)}</strong><time>${label}</time></p>`;
  }

  function openTaskDialog(taskId = null) {
    const task = taskId ? state.tasks.find((item) => item.id === taskId) : null;
    elements.taskForm.reset();
    elements.taskId.value = task?.id || '';
    elements.taskTitle.value = task?.title || '';
    elements.taskNotes.value = task?.notes || '';
    elements.taskPriority.value = task?.priority || 'none';
    elements.taskReminder.value = String(task?.reminderMinutes ?? '0');

    if (task?.dueAt) {
      const due = new Date(task.dueAt);
      elements.taskDate.value = toDateInput(due);
      elements.taskTime.value = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
    } else {
      const due = new Date();
      due.setMinutes(0, 0, 0);
      due.setHours(due.getHours() + 1);
      elements.taskDate.value = toDateInput(due);
      elements.taskTime.value = `${String(due.getHours()).padStart(2, '0')}:00`;
    }

    elements.dialogKicker.textContent = task ? '编辑任务' : '新建任务';
    elements.dialogTitle.textContent = task ? '调整任务安排' : '安排一件事';
    elements.deleteTaskButton.hidden = !task;
    elements.taskDialog.showModal();
    requestAnimationFrame(() => elements.taskTitle.focus());
  }

  function closeTaskDialog() {
    if (elements.taskDialog.open) elements.taskDialog.close();
  }

  function buildDueAt(dateValue, timeValue) {
    if (!dateValue) return null;
    const date = new Date(`${dateValue}T${timeValue || '09:00'}:00`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function submitTask(event) {
    event.preventDefault();
    const title = elements.taskTitle.value.trim();
    if (!title) return elements.taskTitle.focus();

    const dueAt = buildDueAt(elements.taskDate.value, elements.taskTime.value);
    const reminderMinutes = elements.taskReminder.value;
    const existingIndex = state.tasks.findIndex((task) => task.id === elements.taskId.value);
    const existing = existingIndex >= 0 ? state.tasks[existingIndex] : null;
    const reminderAt = core.calculateReminderAt(dueAt, reminderMinutes);
    const task = core.normalizeTask({
      ...existing,
      id: existing?.id || uid(),
      title,
      notes: elements.taskNotes.value,
      dueAt,
      reminderMinutes,
      reminderAt,
      notifiedReminderAt: existing?.reminderAt === reminderAt ? existing.notifiedReminderAt : null,
      priority: elements.taskPriority.value,
      completed: existing?.completed || false,
      createdAt: existing?.createdAt || new Date().toISOString()
    });

    if (existingIndex >= 0) state.tasks.splice(existingIndex, 1, task);
    else state.tasks.push(task);
    saveTasks();
    closeTaskDialog();
    render();
    toast(existing ? '任务已更新' : '任务已添加');
  }

  function quickAdd(event) {
    event.preventDefault();
    const title = elements.quickTitle.value.trim();
    if (!title) return elements.quickTitle.focus();
    const due = new Date();
    due.setSeconds(0, 0);
    due.setMinutes(0);
    due.setHours(due.getHours() + 1);
    if (state.quickDateMode === 'tomorrow') due.setDate(due.getDate() + 1);
    const dueAt = state.quickDateMode === 'none' ? null : due.toISOString();
    state.tasks.push(core.normalizeTask({
      id: uid(), title, dueAt, priority: 'none', completed: false,
      reminderMinutes: dueAt ? '0' : 'none',
      reminderAt: core.calculateReminderAt(dueAt, dueAt ? 0 : 'none'),
      notifiedReminderAt: null,
      createdAt: new Date().toISOString()
    }));
    elements.quickTitle.value = '';
    saveTasks();
    render();
    toast('任务已添加');
  }

  function cycleQuickDate() {
    const modes = ['today', 'tomorrow', 'none'];
    state.quickDateMode = modes[(modes.indexOf(state.quickDateMode) + 1) % modes.length];
    elements.quickDateLabel.textContent = { today: '今天', tomorrow: '明天', none: '无日期' }[state.quickDateMode];
  }

  function toggleComplete(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    saveTasks();
    render();
    toast(task.completed ? '任务已完成' : '任务已恢复');
  }

  function deleteCurrentTask() {
    const id = elements.taskId.value;
    if (!id) return;
    state.tasks = state.tasks.filter((task) => task.id !== id);
    saveTasks();
    closeTaskDialog();
    render();
    toast('任务已删除');
  }

  function setView(view) {
    state.view = view;
    state.selectedDate = null;
    render();
  }

  function showReminder(task) {
    const current = task.isTest ? task : state.tasks.find((item) => item.id === task.id);
    if (!current || current.completed) return;
    if (!current.isTest) {
      current.notifiedReminderAt = current.reminderAt;
      saveTasks();
    }
    toast(current.isTest ? '测试提醒已发送到通知栏' : `提醒：${current.title}`);
  }

  async function testReminder() {
    elements.testReminderButton.disabled = true;
    try {
      await window.flowlist.showNotification({
        id: `test-${Date.now()}`,
        title: 'Flowlist 测试提醒',
        notes: '提醒功能工作正常。',
        dueAt: new Date().toISOString(),
        reminderAt: new Date().toISOString(),
        isTest: true
      });
    } finally {
      elements.testReminderButton.disabled = false;
    }
  }

  async function refreshReminderStatus() {
    try {
      const status = await window.flowlist.getReminderStatus();
      const countText = status.scheduledCount ? ` · ${status.scheduledCount} 项` : '';
      elements.reminderStatus.textContent = `提醒正在运行${countText}`;
    } catch {
      elements.reminderStatus.textContent = '提醒状态未知';
    }
  }

  function focusTask(taskId) {
    state.view = 'all';
    state.query = '';
    elements.searchInput.value = '';
    render();
    const row = document.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`);
    if (row) {
      row.classList.add('focused');
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => row.classList.remove('focused'), 2400);
    }
  }

  function toast(message) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `<i data-lucide="check-circle-2"></i><span>${escapeHtml(message)}</span>`;
    elements.toastRegion.appendChild(node);
    window.lucide.createIcons({ nodes: [node] });
    setTimeout(() => node.remove(), 2600);
  }

  function updateClock() {
    elements.liveClock.textContent = new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(new Date());
  }

  document.querySelector('#viewNavigation').addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (button) setView(button.dataset.view);
  });
  document.querySelectorAll('#openCreateButton, #mobileAddButton, #emptyAddButton').forEach((button) => button.addEventListener('click', () => openTaskDialog()));
  document.querySelector('#quickDateButton').addEventListener('click', cycleQuickDate);
  document.querySelector('#closeDialogButton').addEventListener('click', closeTaskDialog);
  document.querySelector('#cancelTaskButton').addEventListener('click', closeTaskDialog);
  document.querySelector('#deleteTaskButton').addEventListener('click', deleteCurrentTask);
  elements.testReminderButton.addEventListener('click', testReminder);
  document.querySelector('#jumpTodayButton').addEventListener('click', () => setView('today'));
  elements.taskForm.addEventListener('submit', submitTask);
  elements.quickEntryForm.addEventListener('submit', quickAdd);

  elements.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
  });

  elements.taskList.addEventListener('click', (event) => {
    const row = event.target.closest('[data-task-id]');
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!row || !action) return;
    if (action === 'complete') toggleComplete(row.dataset.taskId);
    if (action === 'edit') openTaskDialog(row.dataset.taskId);
  });

  elements.taskList.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.dataset.action === 'edit') {
      event.preventDefault();
      openTaskDialog(event.target.closest('[data-task-id]').dataset.taskId);
    }
  });

  elements.miniCalendar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-calendar-date]');
    if (!button) return;
    state.view = 'date';
    state.selectedDate = button.dataset.calendarDate;
    render();
  });

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      openTaskDialog();
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      elements.searchInput.focus();
    }
  });

  window.flowlist.onReminder(showReminder);
  window.flowlist.onFocusTask(focusTask);
  window.flowlist.onQuickAdd(() => openTaskDialog());

  saveTasks();
  render();
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(refreshReminderStatus, 30_000);
})();
