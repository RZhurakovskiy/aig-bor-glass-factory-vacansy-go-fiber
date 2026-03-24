const storageKey = 'admin-theme-mode'

const elements = {
	form: document.getElementById('loginForm'),
	status: document.getElementById('loginStatus'),
	submitButton: document.getElementById('loginSubmitButton'),
	toastStack: document.getElementById('loginToastStack'),
	passwordInput: document.getElementById('loginPasswordInput'),
	passwordToggle: document.getElementById('loginPasswordToggle'),
	infoButton: document.getElementById('loginInfoDockButton'),
	infoPanel: document.getElementById('loginInfoDockPanel'),
	serverVersionValue: document.getElementById('serverVersionValue'),
	webVersionValue: document.getElementById('webVersionValue'),
	themeSwitcher: document.getElementById('themeSwitcher'),
	themeSystemButton: document.getElementById('themeSystemButton'),
}

const state = {
	infoPanelOpen: false,
	themeMode: document.documentElement.dataset.themeMode || 'light',
}

bindEvents()
initTheme()
void refreshMeta()

function bindEvents() {
	elements.form?.addEventListener('submit', handleSubmit)
	elements.passwordToggle?.addEventListener('click', togglePasswordVisibility)
	elements.infoButton?.addEventListener('click', toggleInfoPanel)
	elements.themeSwitcher?.addEventListener('click', handleThemeSwitcherClick)
	elements.themeSystemButton?.addEventListener('click', handleThemeSystemClick)
	document.addEventListener('click', handleDocumentClick)
	document.addEventListener('keydown', handleDocumentKeydown)
}

function setStatus(message, isError = false) {
	if (!elements.status) return
	elements.status.textContent = message || ''
	elements.status.classList.toggle('is-error', Boolean(isError))
}

function showToast(message, duration = 3200) {
	if (!elements.toastStack || !message) return

	const toast = document.createElement('div')
	toast.className = 'login-toast login-toast_error'
	toast.textContent = message
	toast.style.setProperty('--toast-duration', `${duration}ms`)
	elements.toastStack.appendChild(toast)

	window.setTimeout(() => {
		toast.classList.add('is-leaving')
		window.setTimeout(() => toast.remove(), 240)
	}, duration)
}

function togglePasswordVisibility() {
	if (!elements.passwordInput || !elements.passwordToggle) return

	const isVisible = elements.passwordInput.type === 'text'
	elements.passwordInput.type = isVisible ? 'password' : 'text'
	elements.passwordToggle.classList.toggle('is-visible', !isVisible)
	elements.passwordToggle.setAttribute('aria-pressed', isVisible ? 'false' : 'true')
	elements.passwordToggle.setAttribute(
		'aria-label',
		isVisible ? 'Показать пароль' : 'Скрыть пароль'
	)
}

async function handleSubmit(event) {
	event.preventDefault()
	setStatus('')

	const formData = new FormData(elements.form)
	const payload = {
		login: String(formData.get('login') || '').trim(),
		password: String(formData.get('password') || '').trim(),
	}

	if (!payload.login || !payload.password) {
		const message = 'Введите логин и пароль.'
		setStatus(message, true)
		showToast(message)
		return
	}

	if (elements.submitButton) {
		elements.submitButton.disabled = true
	}
	setStatus('Проверяю данные...')

	try {
		const response = await fetch('/admin/login', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			credentials: 'same-origin',
			body: JSON.stringify(payload),
		})

		let result = {}
		try {
			result = await response.json()
		} catch (_) {}

		if (!response.ok) {
			const message = result.error || 'Не удалось выполнить вход.'
			setStatus(message, true)
			showToast(message)
			return
		}

		window.location.href = '/admin'
	} catch (_) {
		const message =
			'Не удалось выполнить вход. Проверьте соединение и попробуйте снова.'
		setStatus(message, true)
		showToast(message)
	} finally {
		if (elements.submitButton) {
			elements.submitButton.disabled = false
		}
		if (!elements.status?.classList.contains('is-error')) {
			setStatus('')
		}
	}
}

async function refreshMeta() {
	try {
		const response = await fetch('/api/meta', {
			credentials: 'same-origin',
			headers: {
				Accept: 'application/json',
			},
		})

		if (!response.ok) {
			throw new Error(`meta failed: ${response.status}`)
		}

		const meta = await response.json()
		if (elements.serverVersionValue) {
			elements.serverVersionValue.textContent = meta.version || 'Недоступно'
		}
		if (elements.webVersionValue) {
			elements.webVersionValue.textContent = meta.webVersion || 'Недоступно'
		}
	} catch (error) {
		console.error(error)
		;[elements.serverVersionValue, elements.webVersionValue].forEach(element => {
			if (element) element.textContent = 'Недоступно'
		})
	}
}

function initTheme() {
	syncThemeUI()
	window
		.matchMedia('(prefers-color-scheme: dark)')
		.addEventListener('change', () => {
			if (state.themeMode === 'system') {
				applyTheme('system')
			}
		})
}

function handleThemeSwitcherClick(event) {
	const button = event.target.closest('[data-theme-mode]')
	if (!button) return

	const mode = button.dataset.themeMode
	if (!mode) return
	applyTheme(mode)
}

function handleThemeSystemClick() {
	applyTheme('system')
}

function applyTheme(mode) {
	state.themeMode = mode
	localStorage.setItem(storageKey, mode)

	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
	const resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode
	document.documentElement.dataset.themeMode = mode
	document.documentElement.dataset.theme = resolved
	document.documentElement.style.colorScheme = resolved
	syncThemeUI()
}

function syncThemeUI() {
	elements.themeSwitcher?.querySelectorAll('[data-theme-mode]').forEach(button => {
		button.classList.toggle('is-active', button.dataset.themeMode === state.themeMode)
	})

	elements.themeSystemButton?.classList.toggle(
		'is-active',
		state.themeMode === 'system'
	)
}

function toggleInfoPanel() {
	if (state.infoPanelOpen) {
		closeInfoPanel()
		return
	}
	openInfoPanel()
}

function openInfoPanel() {
	if (!elements.infoPanel || !elements.infoButton) return

	state.infoPanelOpen = true
	elements.infoPanel.hidden = false
	elements.infoButton.setAttribute('aria-expanded', 'true')
}

function closeInfoPanel() {
	if (!elements.infoPanel || !elements.infoButton) return

	state.infoPanelOpen = false
	elements.infoPanel.hidden = true
	elements.infoButton.setAttribute('aria-expanded', 'false')
}

function handleDocumentClick(event) {
	if (
		state.infoPanelOpen &&
		!event.target.closest('#loginInfoDockButton') &&
		!event.target.closest('#loginInfoDockPanel')
	) {
		closeInfoPanel()
	}
}

function handleDocumentKeydown(event) {
	if (event.key === 'Escape' && state.infoPanelOpen) {
		closeInfoPanel()
	}
}
