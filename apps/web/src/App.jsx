import { useEffect, useRef, useState } from 'react'
import './App.css'

// Frontend em modo "online-first": tenta API; se falhar, cai para localStorage sem quebrar UX.
const TASKS_STORAGE_KEY = 'my-task-board.tasks'
const BOARD_STORAGE_KEY = 'my-task-board.boardId'
const THEME_STORAGE_KEY = 'my-task-board.theme'
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

const FILTER_OPTIONS = [
  { id: 'all', label: 'Todas' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'completed', label: 'Concluídas' },
]

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'Alta', accent: 'priority-high' },
  { value: 'medium', label: 'Média', accent: 'priority-medium' },
  { value: 'low', label: 'Baixa', accent: 'priority-low' },
]

const PRIORITY_WEIGHT = {
  high: 0,
  medium: 1,
  low: 2,
}

function createTask(title, priority) {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    completed: false,
    priority,
    createdAt: new Date().toISOString(),
  }
}

function parseStoredTasks() {
  const storedTasks = localStorage.getItem(TASKS_STORAGE_KEY)

  if (!storedTasks) {
    return [
      createTask('Revisar o layout da aplicação', 'high'),
      createTask('Adicionar uma tarefa de exemplo', 'medium'),
      createTask('Publicar este projeto no GitHub', 'low'),
    ]
  }

  try {
    const parsed = JSON.parse(storedTasks)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((task) => {
      return (
        typeof task?.id === 'string' &&
        typeof task?.title === 'string' &&
        typeof task?.completed === 'boolean' &&
        typeof task?.createdAt === 'string' &&
        Object.hasOwn(PRIORITY_WEIGHT, task?.priority)
      )
    })
  } catch {
    return []
  }
}

function getInitialTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)

  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateString))
}

function sortTasks(tasks) {
  return [...tasks].sort((firstTask, secondTask) => {
    if (firstTask.completed !== secondTask.completed) {
      return Number(firstTask.completed) - Number(secondTask.completed)
    }

    if (PRIORITY_WEIGHT[firstTask.priority] !== PRIORITY_WEIGHT[secondTask.priority]) {
      return PRIORITY_WEIGHT[firstTask.priority] - PRIORITY_WEIGHT[secondTask.priority]
    }

    return new Date(secondTask.createdAt).getTime() - new Date(firstTask.createdAt).getTime()
  })
}

function mapApiTask(task) {
  return {
    id: task.id,
    title: task.name,
    completed: Boolean(task.completed ?? task.status === 'COMPLETED'),
    priority: String(task.priority ?? 'MEDIUM').toLowerCase(),
    createdAt: task.createdAt,
  }
}

function App() {
  // Estado principal da UI e dos modos (online/offline).
  const [tasks, setTasks] = useState(() => parseStoredTasks())
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('medium')
  const [filter, setFilter] = useState('all')
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingTaskTitle, setEditingTaskTitle] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [theme, setTheme] = useState(() => getInitialTheme())
  const [boardId, setBoardId] = useState(() => localStorage.getItem(BOARD_STORAGE_KEY))
  const [useApi, setUseApi] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  const taskInputRef = useRef(null)
  const editInputRef = useRef(null)

  // Valores derivados usados na renderização e contadores.
  const sortedTasks = sortTasks(tasks)
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((task) => task.completed).length
  const pendingTasks = totalTasks - completedTasks

  const visibleTasks = sortedTasks.filter((task) => {
    if (filter === 'pending') return !task.completed
    if (filter === 'completed') return task.completed
    return true
  })

  // Persistência local somente se estivermos em modo offline.
  useEffect(() => {
    if (!useApi) {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks))
    }
  }, [tasks, useApi])

  // Tema salvo no atributo data-theme do HTML + localStorage.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  // Foco inicial no input.
  useEffect(() => {
    taskInputRef.current?.focus()
  }, [])

  // Quando entra em edição, focar o input correspondente.
  useEffect(() => {
    if (editingTaskId) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
  }, [editingTaskId])

  // Feedbacks expiram automaticamente.
  useEffect(() => {
    if (!feedback) return undefined
    const timeoutId = window.setTimeout(() => setFeedback(null), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [feedback])

  // Carrega dados na montagem: tenta API, senão ativa modo offline.
  useEffect(() => {
    ensureData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fluxo de inicialização: garante boardId e sincroniza tarefas.
  async function ensureData() {
    if (!useApi) {
      setIsLoading(false)
      return
    }

    try {
      let id = boardId

      if (!id) {
        id = await createBoard()
        setBoardId(id)
        localStorage.setItem(BOARD_STORAGE_KEY, id)
      }

      await fetchBoard(id)
    } catch (error) {
      console.error('Falha ao sincronizar com a API, caindo para localStorage', error)
      setUseApi(false)
      setTasks(parseStoredTasks())
    } finally {
      setIsLoading(false)
    }
  }

  // Cria board com seed de tarefas (lado do backend).
  async function createBoard() {
    const response = await fetch(`${API_BASE}/boards`, { method: 'POST' })
    if (!response.ok) throw new Error('Não foi possível criar board')
    const data = await response.json()
    return data.id
  }

  // Busca board; se o backend recriar, captura header x-board-id e salva localmente.
  async function fetchBoard(id) {
    const response = await fetch(`${API_BASE}/boards/${id}`)

    if (response.status === 404) {
      const newId = await createBoard()
      setBoardId(newId)
      localStorage.setItem(BOARD_STORAGE_KEY, newId)
      return fetchBoard(newId)
    }

    if (!response.ok) throw new Error('Erro ao carregar board')

    const board = await response.json()
    const headerBoardId = response.headers.get('x-board-id')

    if (headerBoardId && headerBoardId !== boardId) {
      setBoardId(headerBoardId)
      localStorage.setItem(BOARD_STORAGE_KEY, headerBoardId)
    }

    setTasks(board.tasks.map(mapApiTask))
  }

  // Exibe mensagem curta de feedback.
  function showFeedback(message) {
    setFeedback(message)
  }

  // Criação de tarefa (online/offline).
  async function handleAddTask(event) {
    event.preventDefault()
    const trimmedTitle = newTaskTitle.trim()

    if (!trimmedTitle) {
      showFeedback('Digite uma tarefa antes de adicionar.')
      taskInputRef.current?.focus()
      return
    }

    if (!useApi) {
      setTasks((current) => [createTask(trimmedTitle, newTaskPriority), ...current])
      setNewTaskTitle('')
      setNewTaskPriority('medium')
      showFeedback('Tarefa adicionada (modo offline).')
      taskInputRef.current?.focus()
      return
    }

    try {
      setIsSyncing(true)
      await fetch(`${API_BASE}/boards/${boardId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedTitle,
          priority: newTaskPriority.toUpperCase(),
        }),
      })

      await fetchBoard(boardId)
      setNewTaskTitle('')
      setNewTaskPriority('medium')
      showFeedback('Tarefa adicionada.')
      taskInputRef.current?.focus()
    } catch (error) {
      console.error(error)
      showFeedback('Não foi possível adicionar tarefa agora.')
    } finally {
      setIsSyncing(false)
    }
  }

  // Marca/desmarca tarefa como concluída (online/offline).
  async function handleToggleTask(taskId) {
    const target = tasks.find((task) => task.id === taskId)
    if (!target) return

    if (!useApi) {
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, completed: !task.completed } : task,
        ),
      )
      showFeedback(target.completed ? 'Tarefa marcada como pendente.' : 'Tarefa concluída.')
      return
    }

    try {
      setIsSyncing(true)
      await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !target.completed }),
      })
      await fetchBoard(boardId)
      showFeedback(target.completed ? 'Tarefa marcada como pendente.' : 'Tarefa concluída.')
    } catch (error) {
      console.error(error)
      showFeedback('Não foi possível atualizar o status.')
    } finally {
      setIsSyncing(false)
    }
  }

  // Remove tarefa com confirmação (online/offline).
  async function handleDeleteTask(taskId) {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return

    const confirmed = window.confirm(`Excluir a tarefa "${task.title}"?`)
    if (!confirmed) return

    if (!useApi) {
      setTasks((current) => current.filter((item) => item.id !== taskId))
      showFeedback('Tarefa removida.')
      if (editingTaskId === taskId) {
        setEditingTaskId(null)
        setEditingTaskTitle('')
      }
      return
    }

    try {
      setIsSyncing(true)
      await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' })
      await fetchBoard(boardId)
      showFeedback('Tarefa removida.')
      if (editingTaskId === taskId) {
        setEditingTaskId(null)
        setEditingTaskTitle('')
      }
    } catch (error) {
      console.error(error)
      showFeedback('Não foi possível excluir agora.')
    } finally {
      setIsSyncing(false)
    }
  }

  function handleStartEditing(task) {
    setEditingTaskId(task.id)
    setEditingTaskTitle(task.title)
  }

  function handleCancelEditing() {
    setEditingTaskId(null)
    setEditingTaskTitle('')
    showFeedback('Edição cancelada.')
  }

  // Salva edição de título (online/offline).
  async function handleSaveTask(taskId) {
    const trimmedTitle = editingTaskTitle.trim()
    if (!trimmedTitle) {
      showFeedback('O nome da tarefa não pode ficar vazio.')
      editInputRef.current?.focus()
      return
    }

    if (!useApi) {
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, title: trimmedTitle } : task)),
      )
      setEditingTaskId(null)
      setEditingTaskTitle('')
      showFeedback('Tarefa atualizada.')
      return
    }

    try {
      setIsSyncing(true)
      await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedTitle }),
      })
      await fetchBoard(boardId)
      setEditingTaskId(null)
      setEditingTaskTitle('')
      showFeedback('Tarefa atualizada.')
    } catch (error) {
      console.error(error)
      showFeedback('Não foi possível salvar agora.')
    } finally {
      setIsSyncing(false)
    }
  }

  function handleEditKeyDown(event, taskId) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSaveTask(taskId)
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      handleCancelEditing()
    }
  }

  // Limpa todas as concluídas (online/offline).
  async function handleClearCompleted() {
    if (!completedTasks) {
      showFeedback('Não há tarefas concluídas para limpar.')
      return
    }

    if (!useApi) {
      setTasks((current) => current.filter((task) => !task.completed))
      showFeedback('Tarefas concluídas removidas.')
      return
    }

    try {
      setIsSyncing(true)
      const completed = tasks.filter((task) => task.completed)
      await Promise.all(
        completed.map((task) =>
          fetch(`${API_BASE}/tasks/${task.id}`, {
            method: 'DELETE',
          }),
        ),
      )
      await fetchBoard(boardId)
      showFeedback('Tarefas concluídas removidas.')
    } catch (error) {
      console.error(error)
      showFeedback('Não foi possível limpar agora.')
    } finally {
      setIsSyncing(false)
    }
  }

  function handleThemeToggle() {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  function getEmptyStateMessage() {
    if (isLoading) return 'Carregando suas tarefas...'
    if (!totalTasks) return 'Sua lista está vazia. Adicione a primeira tarefa para começar.'
    if (filter === 'pending') return 'Nenhuma tarefa pendente por aqui. Bom trabalho.'
    if (filter === 'completed') return 'Você ainda não concluiu nenhuma tarefa.'
    return 'Nenhuma tarefa encontrada neste filtro.'
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Task flow</p>
          <h1>To Do List</h1>
          <p className="hero-text">
            Organize tarefas com prioridade, filtros e persistência automática. Interface limpa, leve e pronta
            para desktop e mobile.
          </p>
        </div>

        <div className="hero-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={handleThemeToggle}
            aria-label="Alternar tema da aplicação"
          >
            {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>
        </div>
      </section>

      <section className="dashboard-grid" aria-label="Resumo das tarefas">
        <article className="stat-card">
          <span className="stat-label">Total</span>
          <strong>{totalTasks}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Pendentes</span>
          <strong>{pendingTasks}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Concluídas</span>
          <strong>{completedTasks}</strong>
        </article>
      </section>

      <section className="board-card">
        <form className="task-form" onSubmit={handleAddTask}>
          <label className="field">
            <span className="field-label">Nova tarefa</span>
            <input
              ref={taskInputRef}
              type="text"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="Ex.: Finalizar o README do projeto"
              maxLength={120}
              disabled={isSyncing}
            />
          </label>

          <label className="field field-select">
            <span className="field-label">Prioridade</span>
            <select
              value={newTaskPriority}
              onChange={(event) => setNewTaskPriority(event.target.value)}
              disabled={isSyncing}
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="primary-button" disabled={isSyncing}>
            {isSyncing ? 'Salvando...' : 'Adicionar tarefa'}
          </button>
        </form>

        <div className="toolbar">
          <div className="filter-group" role="tablist" aria-label="Filtros de tarefas">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={filter === option.id}
                className={filter === option.id ? 'filter-chip active' : 'filter-chip'}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="inline-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleClearCompleted}
              disabled={isSyncing}
            >
              Limpar concluídas
            </button>
            {!useApi ? (
              <span className="chip-warning" title="Modo offline: usando localStorage">
                Offline / LocalStorage
              </span>
            ) : null}
          </div>
        </div>

        {feedback ? (
          <div className="feedback-banner" role="status" aria-live="polite">
            {feedback}
          </div>
        ) : null}

        <div className="task-list" aria-live="polite">
          {visibleTasks.length ? (
            visibleTasks.map((task) => {
              const priority = PRIORITY_OPTIONS.find((option) => option.value === task.priority)

              return (
                <article
                  key={task.id}
                  className={task.completed ? 'task-card completed' : 'task-card'}
                >
                  <button
                    type="button"
                    className={task.completed ? 'status-button checked' : 'status-button'}
                    onClick={() => handleToggleTask(task.id)}
                    aria-label={
                      task.completed
                        ? `Desmarcar ${task.title} como concluída`
                        : `Marcar ${task.title} como concluída`
                    }
                    disabled={isSyncing}
                  >
                    {task.completed ? 'Concluída' : 'Pendente'}
                  </button>

                  <div className="task-content">
                    <div className="task-topline">
                      <span className={`priority-badge ${priority?.accent ?? ''}`}>
                        {priority?.label ?? 'Média'}
                      </span>
                      <span className="task-date">{formatDate(task.createdAt)}</span>
                    </div>

                    {editingTaskId === task.id ? (
                      <div className="edit-area">
                        <label className="sr-only" htmlFor={`edit-task-${task.id}`}>
                          Editar tarefa
                        </label>
                        <input
                          id={`edit-task-${task.id}`}
                          ref={editInputRef}
                          type="text"
                          value={editingTaskTitle}
                          onChange={(event) => setEditingTaskTitle(event.target.value)}
                          onKeyDown={(event) => handleEditKeyDown(event, task.id)}
                          maxLength={120}
                          disabled={isSyncing}
                        />

                        <div className="inline-actions">
                          <button
                            type="button"
                            className="primary-button small"
                            onClick={() => handleSaveTask(task.id)}
                            disabled={isSyncing}
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            className="ghost-button small"
                            onClick={handleCancelEditing}
                            disabled={isSyncing}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2>{task.title}</h2>
                        <p>
                          {task.completed
                            ? 'Concluída com sucesso. Você pode mantê-la para histórico ou remover quando quiser.'
                            : 'Tarefa ativa. Use os filtros para acompanhar o progresso da sua lista.'}
                        </p>
                      </>
                    )}
                  </div>

                  {editingTaskId !== task.id ? (
                    <div className="task-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleStartEditing(task)}
                        disabled={isSyncing}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => handleDeleteTask(task.id)}
                        disabled={isSyncing}
                      >
                        Excluir
                      </button>
                    </div>
                  ) : null}
                </article>
              )
            })
          ) : (
            <div className="empty-state">
              <h2>Nada para mostrar</h2>
              <p>{getEmptyStateMessage()}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
