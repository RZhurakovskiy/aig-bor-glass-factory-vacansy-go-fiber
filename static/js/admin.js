const elements = {
	contactsForm: document.getElementById('contactsForm'),
	pageSections: Array.from(document.querySelectorAll('[data-admin-page]')),
	pageLinks: Array.from(document.querySelectorAll('[data-admin-page-link]')),
	logoutButton: document.getElementById('logoutButton'),
	saveButton: document.getElementById('saveButton'),
	statusMessage: document.getElementById('statusMessage'),
	infoDockButton: document.getElementById('infoDockButton'),
	infoDockPanel: document.getElementById('infoDockPanel'),
	serverVersionValue: document.getElementById('serverVersionValue'),
	serverGoVersionValue: document.getElementById('serverGoVersionValue'),
	serverPlatformValue: document.getElementById('serverPlatformValue'),
	serverOsValue: document.getElementById('serverOsValue'),
	serverHostValue: document.getElementById('serverHostValue'),
	themeSwitcher: document.getElementById('themeSwitcher'),
	themeSystemButton: document.getElementById('themeSystemButton'),
	adminMapPreview: document.getElementById('adminMapPreview'),
	toastStack: document.getElementById('toastStack'),
	loaderStack: document.getElementById('loaderStack'),
	vacanciesList: document.getElementById('vacanciesList'),
	vacanciesEmpty: document.getElementById('vacanciesEmpty'),
	usersList: document.getElementById('usersList'),
	usersEmpty: document.getElementById('usersEmpty'),
	metricsTabs: document.getElementById('metricsTabs'),
	metricsTabButtons: Array.from(document.querySelectorAll('[data-metrics-tab]')),
	metricsPanels: Array.from(document.querySelectorAll('[data-metrics-panel]')),
	metricsVacanciesList: document.getElementById('metricsVacanciesList'),
	metricsVacanciesEmpty: document.getElementById('metricsVacanciesEmpty'),
	metricsDailyList: document.getElementById('metricsDailyList'),
	metricsDailyEmpty: document.getElementById('metricsDailyEmpty'),
	metricsDailyLegend: document.getElementById('metricsDailyLegend'),
	metricsEventsList: document.getElementById('metricsEventsList'),
	metricsEventsEmpty: document.getElementById('metricsEventsEmpty'),
	metricTotalViews: document.getElementById('metricTotalViews'),
	metricTodayViews: document.getElementById('metricTodayViews'),
	metricUniqueIps: document.getElementById('metricUniqueIps'),
	openTrashButton: document.getElementById('openTrashButton'),
	openTrashCount: document.getElementById('openTrashCount'),
	trashVacanciesList: document.getElementById('trashVacanciesList'),
	trashEmpty: document.getElementById('trashEmpty'),
	emptyTrashButton: document.getElementById('emptyTrashButton'),
	trashModal: document.getElementById('trashModal'),
	closeTrashButton: document.getElementById('closeTrashButton'),
	vacancyForm: document.getElementById('vacancyForm'),
	vacancyFormTitle: document.getElementById('vacancyFormTitle'),
	vacancyStatusMessage: document.getElementById('vacancyStatusMessage'),
	saveVacancyButton: document.getElementById('saveVacancyButton'),
	resetVacancyButton: document.getElementById('resetVacancyButton'),
	createVacancyButton: document.getElementById('createVacancyButton'),
	resetVacancyModal: document.getElementById('resetVacancyModal'),
	confirmResetVacancyButton: document.getElementById('confirmResetVacancyButton'),
	cancelResetVacancyButton: document.getElementById('cancelResetVacancyButton'),
	userForm: document.getElementById('userForm'),
	userFormTitle: document.getElementById('userFormTitle'),
	userStatusMessage: document.getElementById('userStatusMessage'),
	saveUserButton: document.getElementById('saveUserButton'),
	resetUserButton: document.getElementById('resetUserButton'),
	createUserButton: document.getElementById('createUserButton'),
	deleteVacancyModal: document.getElementById('deleteVacancyModal'),
	deleteVacancyTitle: document.getElementById('deleteVacancyTitle'),
	deleteVacancyText: document.getElementById('deleteVacancyText'),
	confirmDeleteVacancyButton: document.getElementById('confirmDeleteVacancyButton'),
	cancelDeleteVacancyButton: document.getElementById('cancelDeleteVacancyButton'),
	listEditors: {
		phones: document.querySelector('[data-list-editor="phones"]'),
		schedule: document.querySelector('[data-list-editor="schedule"]'),
		duties: document.querySelector('[data-list-editor="duties"]'),
		requirements: document.querySelector('[data-list-editor="requirements"]'),
		conditions: document.querySelector('[data-list-editor="conditions"]'),
	},
}

const state = {
	vacancies: [],
	trashVacancies: [],
	users: [],
	metrics: null,
	adminMeta: null,
	adminMap: null,
	adminPlacemark: null,
	adminMapCoordinates: null,
	adminMapAddress: '',
	currentPage: getCurrentAdminPage(),
	infoPanelOpen: false,
	ymapsReady: null,
	themeMode: document.documentElement.dataset.themeMode || 'system',
	activeMetricsTab: 'vacancies',
	selectedVacancyId: null,
	selectedUserId: null,
	pendingVacancyReset: false,
	pendingDeleteVacancyId: null,
	pendingDeleteMode: null,
	loaders: new Map(),
}

const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

bootstrap().catch(error => {
	console.error(error)
	setStatus('Не удалось загрузить контакты.', true)
	setVacancyStatus('Не удалось загрузить вакансии.', true)
	setUserStatus('Не удалось загрузить пользователей.', true)
	showToast('Не удалось загрузить данные админки.', 'error')
})

async function bootstrap() {
	initTheme()
	initAdminPage()
	bindEvents()
	const tasks = []

	tasks.push(
		runStartupTask('system-meta', 'Системная информация', () =>
			refreshAdminMeta().catch(handleAdminMetaError)
		)
	)

	if (isContactsPage() && elements.contactsForm) {
		tasks.push(runStartupTask('contacts', 'Контакты и карта', () => refreshContacts()))
	}

	if (isVacanciesPage() && hasVacancyUI()) {
		tasks.push(runStartupTask('vacancies', 'Список вакансий', () => refreshVacancies()))
		tasks.push(
			runStartupTask('vacancies-trash', 'Корзина вакансий', () =>
				refreshTrashVacancies()
			)
		)
	}

	if (isUsersPage() && hasUsersUI()) {
		tasks.push(runStartupTask('users', 'Пользователи', () => refreshUsers()))
	}

	if (isMetricsPage() && hasMetricsUI()) {
		tasks.push(
			runStartupTask('metrics', 'Метрики просмотров', () => refreshMetrics())
		)
	}

	await Promise.all(tasks)
}

function bindEvents() {
	if (isContactsPage() && elements.contactsForm) {
		elements.contactsForm.addEventListener('submit', handleContactsSubmit)
		elements.contactsForm.addEventListener('click', handleContactsFormClick)
	}
	if (isContactsPage() && elements.saveButton) {
		elements.saveButton.addEventListener('click', handleContactsSubmit)
	}

	if (elements.logoutButton) {
		elements.logoutButton.addEventListener('click', handleLogout)
	}
	if (elements.infoDockButton) {
		elements.infoDockButton.addEventListener('click', toggleInfoPanel)
	}
	if (elements.themeSwitcher) {
		elements.themeSwitcher.addEventListener('click', handleThemeSwitcherClick)
	}
	if (elements.themeSystemButton) {
		elements.themeSystemButton.addEventListener('click', handleThemeSystemClick)
	}

	if (elements.confirmDeleteVacancyButton) {
		elements.confirmDeleteVacancyButton.addEventListener('click', confirmVacancyDelete)
	}

	if (elements.confirmResetVacancyButton) {
		elements.confirmResetVacancyButton.addEventListener('click', confirmVacancyReset)
	}

	if (elements.cancelDeleteVacancyButton) {
		elements.cancelDeleteVacancyButton.addEventListener('click', closeDeleteVacancyModal)
	}

	if (elements.cancelResetVacancyButton) {
		elements.cancelResetVacancyButton.addEventListener('click', closeResetVacancyModal)
	}

	if (elements.emptyTrashButton) {
		elements.emptyTrashButton.addEventListener('click', handleEmptyTrashClick)
	}

	if (elements.openTrashButton) {
		elements.openTrashButton.addEventListener('click', handleOpenTrash)
	}

	if (elements.closeTrashButton) {
		elements.closeTrashButton.addEventListener('click', closeTrashModal)
	}

	if (isVacanciesPage() && hasVacancyUI()) {
		elements.vacancyForm.addEventListener('submit', handleVacancySubmit)
		elements.saveVacancyButton.addEventListener('click', handleVacancySubmit)
		elements.resetVacancyButton.addEventListener('click', handleResetVacancyClick)
		elements.createVacancyButton.addEventListener('click', resetVacancyForm)
		elements.vacancyForm.addEventListener('click', handleVacancyFormClick)
		elements.vacanciesList.addEventListener('click', handleVacancyListClick)
		elements.vacanciesList.addEventListener('change', handleVacancyListChange)
		elements.trashVacanciesList.addEventListener('click', handleTrashListClick)
	}

	if (isUsersPage() && hasUsersUI()) {
		elements.userForm.addEventListener('submit', handleUserSubmit)
		elements.saveUserButton.addEventListener('click', handleUserSubmit)
		elements.resetUserButton.addEventListener('click', resetUserForm)
		elements.createUserButton.addEventListener('click', resetUserForm)
		elements.usersList.addEventListener('click', handleUserListClick)
	}

	if (isMetricsPage() && elements.metricsTabs) {
		elements.metricsTabs.addEventListener('click', handleMetricsTabClick)
	}

	document.addEventListener('click', handleDocumentClick)
	document.addEventListener('keydown', handleDocumentKeydown)
}

function initAdminPage() {
	elements.pageSections.forEach(section => {
		section.hidden = section.dataset.adminPage !== state.currentPage
	})

	elements.pageLinks.forEach(link => {
		link.classList.toggle('is-active', link.dataset.adminPageLink === state.currentPage)
		link.setAttribute(
			'aria-current',
			link.dataset.adminPageLink === state.currentPage ? 'page' : 'false'
		)
	})

	if (isMetricsPage()) {
		syncMetricsTabsUI()
	}
}

function getCurrentAdminPage() {
	const path = window.location.pathname.replace(/\/+$/, '')
	if (path.endsWith('/contacts')) return 'contacts'
	if (path.endsWith('/users')) return 'users'
	if (path.endsWith('/metrics')) return 'metrics'
	return 'vacancies'
}

function isVacanciesPage() {
	return state.currentPage === 'vacancies'
}

function isContactsPage() {
	return state.currentPage === 'contacts'
}

function isUsersPage() {
	return state.currentPage === 'users'
}

function isMetricsPage() {
	return state.currentPage === 'metrics'
}

function handleMetricsTabClick(event) {
	const button = event.target.closest('[data-metrics-tab]')
	if (!button) return

	state.activeMetricsTab = button.dataset.metricsTab || 'vacancies'
	syncMetricsTabsUI()
}

function syncMetricsTabsUI() {
	elements.metricsTabButtons.forEach(button => {
		const isActive = button.dataset.metricsTab === state.activeMetricsTab
		button.classList.toggle('is-active', isActive)
		button.setAttribute('aria-selected', isActive ? 'true' : 'false')
	})

	elements.metricsPanels.forEach(panel => {
		panel.hidden = panel.dataset.metricsPanel !== state.activeMetricsTab
	})
}

async function refreshContacts() {
	const contacts = await api('/api/admin/contacts')

	setListEditorItems('phones', contacts.phonesList || splitLines(contacts.phones))
	elements.contactsForm.elements.namedItem('email').value = contacts.email || ''
	elements.contactsForm.elements.namedItem('mapUrl').value = contacts.mapUrl || ''
	elements.contactsForm.elements.namedItem('vk').value = contacts.vk || ''
	elements.contactsForm.elements.namedItem('telegram').value =
		contacts.telegram || ''
	elements.contactsForm.elements.namedItem('whatsapp').value =
		contacts.whatsapp || ''

	await syncAdminMapFromContacts(contacts)
}

async function refreshAdminMeta() {
	const response = await fetch('/api/admin/meta', {
		credentials: 'same-origin',
		headers: {
			Accept: 'application/json',
		},
	})

	if (!response.ok) {
		throw new Error(`meta failed: ${response.status}`)
	}

	const contentType = response.headers.get('Content-Type') || ''
	if (!contentType.includes('application/json')) {
		throw new Error('meta response is not json')
	}

	const meta = await response.json()
	state.adminMeta = meta

	if (elements.serverVersionValue) {
		elements.serverVersionValue.textContent = meta.version || 'unknown'
	}
	if (elements.serverGoVersionValue) {
		elements.serverGoVersionValue.textContent = meta.goVersion || 'unknown'
	}
	if (elements.serverPlatformValue) {
		elements.serverPlatformValue.textContent = meta.platform || 'unknown'
	}
	if (elements.serverOsValue) {
		elements.serverOsValue.textContent = meta.osName || 'unknown'
	}
	if (elements.serverHostValue) {
		elements.serverHostValue.textContent = meta.hostname || 'unknown'
	}
}

function handleAdminMetaError(error) {
	console.error(error)
	if (elements.serverVersionValue) {
		elements.serverVersionValue.textContent = 'Недоступно'
	}
	if (elements.serverGoVersionValue) {
		elements.serverGoVersionValue.textContent = 'Недоступно'
	}
	if (elements.serverPlatformValue) {
		elements.serverPlatformValue.textContent = 'Недоступно'
	}
	if (elements.serverOsValue) {
		elements.serverOsValue.textContent = 'Недоступно'
	}
	if (elements.serverHostValue) {
		elements.serverHostValue.textContent = 'Недоступно'
	}
}

async function syncAdminMapFromContacts(contacts) {
	if (!elements.adminMapPreview) return

	const map = await ensureAdminMap()
	if (!map) return

	const latitude = Number.isFinite(contacts.mapLatitude)
		? contacts.mapLatitude
		: 56.334612
	const longitude = Number.isFinite(contacts.mapLongitude)
		? contacts.mapLongitude
		: 44.103409

	state.adminMapCoordinates = [latitude, longitude]
	state.adminMapAddress = contacts.address || ''
	updateAdminMapPoint([latitude, longitude], {
		center: true,
		address: contacts.address || '',
	})
}

async function ensureAdminMap() {
	if (!elements.adminMapPreview || !window.ymaps) return null

	if (!state.ymapsReady) {
		state.ymapsReady = new Promise(resolve => {
			window.ymaps.ready(resolve)
		})
	}

	await state.ymapsReady

	if (state.adminMap) return state.adminMap

	state.adminMap = new window.ymaps.Map(
		'adminMapPreview',
		{
			center: [56.334612, 44.103409],
			zoom: 15,
			controls: ['zoomControl'],
		},
		{
			suppressMapOpenBlock: true,
		}
	)

	state.adminPlacemark = new window.ymaps.Placemark(
		[56.334612, 44.103409],
		{},
		{
			preset: 'islands#darkGrayDotIcon',
			draggable: true,
		}
	)

	state.adminPlacemark.events.add('dragend', () => {
		const coords = state.adminPlacemark.geometry.getCoordinates()
		void reverseGeocodeCoordinates(coords)
	})

	state.adminMap.events.add('click', event => {
		const coords = event.get('coords')
		void reverseGeocodeCoordinates(coords)
	})

	state.adminMap.geoObjects.add(state.adminPlacemark)
	return state.adminMap
}

function updateAdminMapPoint(coords, options = {}) {
	if (!state.adminMap || !state.adminPlacemark || !Array.isArray(coords)) return

	const [latitude, longitude] = coords
	state.adminMapCoordinates = [latitude, longitude]
	state.adminPlacemark.geometry.setCoordinates([latitude, longitude])

	if (options.center !== false) {
		state.adminMap.setCenter([latitude, longitude], state.adminMap.getZoom(), {
			duration: 200,
		})
	}

	if (elements.contactsForm?.elements.namedItem('mapUrl')) {
		elements.contactsForm.elements.namedItem('mapUrl').value = buildMapURL(
			latitude,
			longitude
		)
	}
	if (typeof options.address === 'string') {
		state.adminMapAddress = options.address
	}
}

async function reverseGeocodeCoordinates(coords) {
	const map = await ensureAdminMap()
	if (!map || !window.ymaps) return

	updateAdminMapPoint(coords, { center: true })

	try {
		const result = await window.ymaps.geocode(coords)
		const first = result.geoObjects.get(0)
		const address =
			first?.getAddressLine?.() ||
			first?.properties?.get('text') ||
			first?.properties?.get('name') ||
			''

		if (address) {
			state.adminMapAddress = address
		}
	} catch (error) {
		console.error(error)
	}
}

async function refreshVacancies() {
	const vacancies = await api('/api/admin/vacancies')
	state.vacancies = vacancies

	if (
		state.selectedVacancyId &&
		!vacancies.some(vacancy => vacancy.id === state.selectedVacancyId)
	) {
		state.selectedVacancyId = null
	}

	renderVacancies()

	if (state.selectedVacancyId) {
		const selected = findVacancy(state.selectedVacancyId)
		if (selected) fillVacancyForm(selected)
		return
	}

	resetVacancyForm()
}

async function refreshTrashVacancies() {
	const vacancies = await api('/api/admin/vacancies/trash')
	state.trashVacancies = vacancies
	renderTrashVacancies()
}

async function refreshUsers() {
	const users = await api('/api/admin/users')
	state.users = users

	if (state.selectedUserId && !users.some(user => user.id === state.selectedUserId)) {
		state.selectedUserId = null
	}

	renderUsers()

	if (state.selectedUserId) {
		const selected = findUser(state.selectedUserId)
		if (selected) {
			fillUserForm(selected)
			return
		}
	}

	resetUserForm()
}

async function refreshMetrics() {
	const metrics = await api('/api/admin/metrics/vacancy-views')
	state.metrics = metrics
	renderMetrics()
}

function renderVacancies() {
	if (!hasVacancyUI()) return

	elements.vacanciesList.innerHTML = ''
	elements.vacanciesEmpty.hidden = state.vacancies.length > 0

	if (!state.vacancies.length) return

	const fragment = document.createDocumentFragment()

	state.vacancies.forEach((vacancy, index) => {
		const item = document.createElement('article')
		item.className = 'admin-vacancy-card'
		if (vacancy.id === state.selectedVacancyId) {
			item.classList.add('is-active')
		}

		const summary = escapeHtml(getVacancyPreviewText(vacancy))

		item.innerHTML = `
			<div class="admin-vacancy-card__content">
				<div class="admin-vacancy-card__meta">
					<label class="admin-publish-toggle">
						<input
							class="admin-publish-toggle__input"
							data-toggle-active="${vacancy.id}"
							type="checkbox"
							${vacancy.active ? 'checked' : ''}
						/>
						<span class="admin-publish-toggle__control"></span>
						<span class="admin-publish-toggle__label">
							${vacancy.active ? 'Опубликована' : 'Скрыта'}
						</span>
					</label>
					<span class="admin-vacancy-card__order">Вакансия ${index + 1}</span>
				</div>
				<h3 class="admin-vacancy-card__title">${escapeHtml(vacancy.title)}</h3>
				<p class="admin-vacancy-card__summary">${summary}</p>
			</div>
			<div class="admin-vacancy-card__actions">
				<button class="admin-btn admin-btn_compact" data-action="move-up" data-id="${vacancy.id}" type="button" ${
					index === 0 ? 'disabled' : ''
				}>
					Выше
				</button>
				<button class="admin-btn admin-btn_compact" data-action="move-down" data-id="${vacancy.id}" type="button" ${
					index === state.vacancies.length - 1 ? 'disabled' : ''
				}>
					Ниже
				</button>
				<button class="admin-btn" data-action="edit" data-id="${vacancy.id}" type="button">
					Редактировать
				</button>
				<button class="admin-btn admin-btn_danger" data-action="delete" data-id="${vacancy.id}" type="button">
					Удалить
				</button>
			</div>
		`

		fragment.appendChild(item)
	})

	elements.vacanciesList.appendChild(fragment)
}

function renderTrashVacancies() {
	if (!hasVacancyUI()) return

	updateTrashButtonCount()
	elements.trashVacanciesList.innerHTML = ''
	elements.trashEmpty.hidden = state.trashVacancies.length > 0
	elements.emptyTrashButton.disabled = state.trashVacancies.length === 0

	if (!state.trashVacancies.length) return

	const fragment = document.createDocumentFragment()

	state.trashVacancies.forEach(vacancy => {
		const item = document.createElement('article')
		item.className = 'admin-vacancy-card admin-vacancy-card_trash'

		const trashedAt = vacancy.trashedAt
			? new Date(vacancy.trashedAt).toLocaleString('ru-RU')
			: ''

		item.innerHTML = `
			<div class="admin-vacancy-card__content">
				<div class="admin-vacancy-card__meta">
					<span class="admin-badge admin-badge_muted">В корзине</span>
					${trashedAt ? `<span class="admin-vacancy-card__order">${escapeHtml(trashedAt)}</span>` : ''}
				</div>
				<h3 class="admin-vacancy-card__title">${escapeHtml(vacancy.title)}</h3>
			</div>
			<div class="admin-vacancy-card__actions">
				<button class="admin-btn" data-trash-action="restore" data-id="${vacancy.id}" type="button">
					Восстановить
				</button>
				<button class="admin-btn admin-btn_danger" data-trash-action="purge" data-id="${vacancy.id}" type="button">
					Удалить навсегда
				</button>
			</div>
		`

		fragment.appendChild(item)
	})

	elements.trashVacanciesList.appendChild(fragment)
}

function renderUsers() {
	if (!hasUsersUI()) return

	elements.usersList.innerHTML = ''
	elements.usersEmpty.hidden = state.users.length > 0

	if (!state.users.length) return

	const fragment = document.createDocumentFragment()

	state.users.forEach(user => {
		const item = document.createElement('article')
		item.className = 'admin-vacancy-card'
		if (user.id === state.selectedUserId) {
			item.classList.add('is-active')
		}

		item.innerHTML = `
			<div class="admin-vacancy-card__content">
				<div class="admin-vacancy-card__meta">
					<span class="admin-badge ${user.active ? 'admin-badge_success' : 'admin-badge_muted'}">
						${user.active ? 'Доступ разрешен' : 'Доступ отключен'}
					</span>
					${user.isRoot ? '<span class="admin-badge admin-badge_root">Главный пользователь</span>' : ''}
					<span class="admin-vacancy-card__order">${escapeHtml(getRoleLabel(user.role))}</span>
				</div>
				<h3 class="admin-vacancy-card__title">${escapeHtml(user.login)}</h3>
				<p class="admin-vacancy-card__summary">Обновлен: ${escapeHtml(user.updatedAt || 'только что')}</p>
			</div>
			<div class="admin-vacancy-card__actions">
				<button class="admin-btn" data-user-action="edit" data-id="${user.id}" type="button">
					Редактировать
				</button>
			</div>
		`

		fragment.appendChild(item)
	})

	elements.usersList.appendChild(fragment)
}

function renderMetrics() {
	if (!hasMetricsUI()) return

	const metrics = state.metrics || {
		totalViews: 0,
		todayViews: 0,
		uniqueIps: 0,
		dailyViews: [],
		vacancies: [],
		recentEvents: [],
	}

	elements.metricTotalViews.textContent = formatNumber(metrics.totalViews)
	elements.metricTodayViews.textContent = formatNumber(metrics.todayViews)
	elements.metricUniqueIps.textContent = formatNumber(metrics.uniqueIps)

	elements.metricsVacanciesList.innerHTML = ''
	elements.metricsDailyList.innerHTML = ''
	if (elements.metricsDailyLegend) {
		elements.metricsDailyLegend.innerHTML = ''
	}
	elements.metricsEventsList.innerHTML = ''
	elements.metricsVacanciesEmpty.hidden = metrics.vacancies.length > 0
	elements.metricsDailyEmpty.hidden = !metrics.dailyViews.every(item => Number(item.viewsCount) === 0)
	elements.metricsEventsEmpty.hidden = metrics.recentEvents.length > 0

	if (metrics.vacancies.length) {
		const vacanciesFragment = document.createDocumentFragment()

		metrics.vacancies.forEach(item => {
			const card = document.createElement('article')
			card.className = 'admin-vacancy-card'
			card.innerHTML = `
				<div class="admin-vacancy-card__content">
					<div class="admin-vacancy-card__meta">
						<span class="admin-badge ${item.active ? 'admin-badge_success' : 'admin-badge_muted'}">
							${item.active ? 'На сайте' : 'Скрыта'}
						</span>
					</div>
					<h3 class="admin-vacancy-card__title">${escapeHtml(item.title)}</h3>
					<p class="admin-vacancy-card__summary">
						Просмотров: ${escapeHtml(formatNumber(item.viewsCount))}
						${item.lastViewedAt ? ` • Последний: ${escapeHtml(item.lastViewedAt)}` : ''}
					</p>
				</div>
			`
			vacanciesFragment.appendChild(card)
		})

		elements.metricsVacanciesList.appendChild(vacanciesFragment)
	}

	const maxDailyViews = metrics.dailyViews.reduce(
		(max, item) => Math.max(max, Number(item.viewsCount) || 0),
		0
	)

	const legendItems = []
	const seenLegendKeys = new Set()
	metrics.dailyViews.forEach(item => {
		const segments = Array.isArray(item.segments) ? item.segments : []
		segments.forEach(segment => {
			const key = String(segment.vacancyId)
			if (seenLegendKeys.has(key)) return
			seenLegendKeys.add(key)
			legendItems.push(segment)
		})
	})

	if (elements.metricsDailyLegend && legendItems.length) {
		const legendFragment = document.createDocumentFragment()

		legendItems.forEach(segment => {
			const legend = document.createElement('div')
			legend.className = 'admin-metrics-legend__item'
			legend.innerHTML = `
				<span class="admin-metrics-legend__swatch" style="background: ${getMetricsSegmentColor(segment.vacancyId)};"></span>
				<span class="admin-metrics-legend__text">${escapeHtml(segment.title)}</span>
			`
			legendFragment.appendChild(legend)
		})

		elements.metricsDailyLegend.appendChild(legendFragment)
	}

	if (metrics.dailyViews.length) {
		const dailyFragment = document.createDocumentFragment()

		;[...metrics.dailyViews].reverse().forEach(item => {
			const viewsCount = Number(item.viewsCount) || 0
			const segments = Array.isArray(item.segments) ? item.segments : []
			const height =
				maxDailyViews > 0
					? Math.max((viewsCount / maxDailyViews) * 100, viewsCount > 0 ? 10 : 0)
					: 0
			const column = document.createElement('article')
			column.className = 'admin-metric-day'
			const segmentsMarkup = segments
				.map(segment => {
					const segmentHeight =
						viewsCount > 0 ? (Number(segment.viewsCount) / viewsCount) * 100 : 0
					const color = getMetricsSegmentColor(segment.vacancyId)
					const title = `${segment.title}: ${formatNumber(segment.viewsCount)}`
					return `<div class="admin-metric-day__segment" style="height: ${segmentHeight}%; background: ${color};" title="${escapeAttribute(title)}"></div>`
				})
				.join('')
			column.innerHTML = `
				<div class="admin-metric-day__value">${escapeHtml(formatNumber(viewsCount))}</div>
				<div class="admin-metric-day__track">
					<div class="admin-metric-day__bar" style="height: ${height}%;">${segmentsMarkup}</div>
				</div>
				<div class="admin-metric-day__label">${escapeHtml(item.label)}</div>
			`
			dailyFragment.appendChild(column)
		})

		elements.metricsDailyList.appendChild(dailyFragment)
	}

	if (metrics.recentEvents.length) {
		const eventsFragment = document.createDocumentFragment()

		metrics.recentEvents.forEach(item => {
			const card = document.createElement('article')
			card.className = 'admin-vacancy-card'
			card.innerHTML = `
				<div class="admin-vacancy-card__content">
					<div class="admin-vacancy-card__meta">
						<span class="admin-badge admin-badge_muted">${escapeHtml(item.viewedAt || 'без времени')}</span>
						<span class="admin-vacancy-card__order">IP ${escapeHtml(item.ipAddress || 'не определен')}</span>
					</div>
					<h3 class="admin-vacancy-card__title">${escapeHtml(item.title)}</h3>
					<p class="admin-vacancy-card__summary">
						${escapeHtml(item.pagePath || '/')}
						${item.referrer ? ` • ${escapeHtml(item.referrer)}` : ''}
					</p>
					<p class="admin-vacancy-card__summary">${escapeHtml(trimUserAgent(item.userAgent))}</p>
				</div>
			`
			eventsFragment.appendChild(card)
		})

		elements.metricsEventsList.appendChild(eventsFragment)
	}
}

function updateTrashButtonCount() {
	if (!elements.openTrashCount) return

	const count = state.trashVacancies.length
	elements.openTrashCount.textContent = String(count)
	elements.openTrashCount.hidden = count === 0
}

function handleVacancyListClick(event) {
	const button = event.target.closest('[data-action]')
	if (!button) return

	const id = Number(button.dataset.id)
	if (!id) return

	if (button.dataset.action === 'edit') {
		const vacancy = findVacancy(id)
		if (!vacancy) return

		fillVacancyForm(vacancy)
		setVacancyStatus('')
		return
	}

	if (button.dataset.action === 'move-up') {
		void moveVacancy(id, -1)
		return
	}

	if (button.dataset.action === 'move-down') {
		void moveVacancy(id, 1)
		return
	}

	if (button.dataset.action === 'delete') {
		void handleVacancyDelete(id)
	}
}

function handleVacancyListChange(event) {
	const toggle = event.target.closest('[data-toggle-active]')
	if (!toggle) return

	const id = Number(toggle.dataset.toggleActive)
	if (!id) return

	void updateVacancyActive(id, toggle.checked, toggle)
}

function handleTrashListClick(event) {
	const button = event.target.closest('[data-trash-action]')
	if (!button) return

	const id = Number(button.dataset.id)
	if (!id) return

	if (button.dataset.trashAction === 'purge') {
		const vacancy = state.trashVacancies.find(item => item.id === id)
		if (vacancy) openDeleteVacancyModal(vacancy, 'purge')
		return
	}

	if (button.dataset.trashAction === 'restore') {
		void handleRestoreVacancy(id)
	}
}

function handleUserListClick(event) {
	const button = event.target.closest('[data-user-action]')
	if (!button) return

	const id = Number(button.dataset.id)
	if (!id) return

	if (button.dataset.userAction === 'edit') {
		const user = findUser(id)
		if (!user) return

		fillUserForm(user)
		setUserStatus('')
	}
}

async function handleVacancySubmit(event) {
	if (event) {
		event.preventDefault()
	}
	const submitButton =
		event?.type === 'click' && event.currentTarget instanceof HTMLElement
			? event.currentTarget
			: elements.saveVacancyButton

	const formData = new FormData(elements.vacancyForm)
	const vacancyId = Number(formData.get('id') || 0)
	const currentVacancy = vacancyId ? findVacancy(vacancyId) : null
	const payload = {
		title: readText(formData.get('title')),
		salary: readText(formData.get('salary')),
		summary: '',
		schedule: joinListEditorItems('schedule'),
		duties: joinListEditorItems('duties'),
		requirements: joinListEditorItems('requirements'),
		conditions: joinListEditorItems('conditions'),
		active: vacancyId ? currentVacancy?.active : true,
	}

	elements.saveVacancyButton.disabled = true
	setButtonLoading(submitButton, true)
	setVacancyStatus(vacancyId ? 'Сохраняю вакансию...' : 'Создаю вакансию...')

	try {
		const vacancy = await api(
			vacancyId ? `/api/admin/vacancies/${vacancyId}` : '/api/admin/vacancies',
			{
				method: vacancyId ? 'PUT' : 'POST',
				body: JSON.stringify(payload),
			}
		)

		state.selectedVacancyId = vacancy.id
		await refreshVacancies()
		const message = vacancyId ? 'Вакансия сохранена.' : 'Вакансия создана.'
		setVacancyStatus(message)
		showToast(message)
	} catch (error) {
		console.error(error)
		const message = getErrorMessage(error, 'Не удалось сохранить вакансию.')
		setVacancyStatus(message, true)
		showToast(message, 'error')
	} finally {
		elements.saveVacancyButton.disabled = false
		setButtonLoading(submitButton, false)
	}
}

async function handleUserSubmit(event) {
	if (event) {
		event.preventDefault()
	}

	const submitButton =
		event?.type === 'click' && event.currentTarget instanceof HTMLElement
			? event.currentTarget
			: elements.saveUserButton

	const formData = new FormData(elements.userForm)
	const userId = Number(formData.get('id') || 0)
	const payload = {
		login: readText(formData.get('login')),
		password: String(formData.get('password') ?? '').trim(),
		role: readText(formData.get('role')),
		active: formData.get('active') === 'on',
	}

	elements.saveUserButton.disabled = true
	setButtonLoading(submitButton, true)
	setUserStatus(userId ? 'Сохраняю пользователя...' : 'Создаю пользователя...')

	try {
		const user = await api(userId ? `/api/admin/users/${userId}` : '/api/admin/users', {
			method: userId ? 'PUT' : 'POST',
			body: JSON.stringify(payload),
		})

		state.selectedUserId = user.id
		await refreshUsers()
		const message = userId ? 'Пользователь сохранен.' : 'Пользователь создан.'
		setUserStatus(message)
		showToast(message)
	} catch (error) {
		console.error(error)
		const message = getErrorMessage(error, 'Не удалось сохранить пользователя.')
		setUserStatus(message, true)
		showToast(message, 'error')
	} finally {
		elements.saveUserButton.disabled = false
		setButtonLoading(submitButton, false)
	}
}

async function handleVacancyDelete(id) {
	const vacancy = findVacancy(id)
	if (!vacancy) return

	openDeleteVacancyModal(vacancy, 'trash')
}

async function confirmVacancyDelete() {
	const id = state.pendingDeleteVacancyId
	const mode = state.pendingDeleteMode
	if (!mode || (mode !== 'empty-trash' && !id)) return

	closeDeleteVacancyModal()
	setVacancyStatus(
		mode === 'trash'
			? 'Перемещаю вакансию в корзину...'
			: mode === 'purge'
				? 'Удаляю вакансию навсегда...'
				: 'Очищаю корзину...'
	)

	try {
		if (mode === 'empty-trash') {
			await api('/api/admin/vacancies/trash', { method: 'DELETE' })
		} else {
			await api(
				mode === 'trash'
					? `/api/admin/vacancies/${id}`
					: `/api/admin/vacancies/${id}/permanent`,
				{ method: 'DELETE' }
			)
		}

		if (mode !== 'empty-trash' && state.selectedVacancyId === id) {
			state.selectedVacancyId = null
		}

		await Promise.all([refreshVacancies(), refreshTrashVacancies()])
		const message =
			mode === 'trash'
				? 'Вакансия перемещена в корзину.'
				: mode === 'purge'
					? 'Вакансия удалена навсегда.'
					: 'Корзина очищена.'
		setVacancyStatus(message)
		showToast(message)
	} catch (error) {
		console.error(error)
		const message = getErrorMessage(
			error,
			mode === 'trash'
				? 'Не удалось переместить вакансию в корзину.'
				: mode === 'purge'
					? 'Не удалось удалить вакансию навсегда.'
					: 'Не удалось очистить корзину.'
		)
		setVacancyStatus(message, true)
		showToast(message, 'error')
	}
}

function openDeleteVacancyModal(vacancy, mode) {
	if (!elements.deleteVacancyModal || !elements.deleteVacancyText) return

	state.pendingDeleteVacancyId = vacancy.id
	state.pendingDeleteMode = mode
	if (elements.deleteVacancyTitle) {
		elements.deleteVacancyTitle.textContent = 'Удалить вакансию?'
	}
	elements.confirmDeleteVacancyButton.textContent =
		mode === 'trash' ? 'В корзину' : 'Удалить навсегда'
	elements.deleteVacancyText.textContent =
		mode === 'trash'
			? `Вакансия «${vacancy.title}» будет перемещена в корзину.`
			: `Вакансия «${vacancy.title}» будет удалена навсегда без возможности восстановления.`
	openModal(elements.deleteVacancyModal)
	syncModalState()
}

function closeDeleteVacancyModal() {
	if (!elements.deleteVacancyModal) return

	state.pendingDeleteVacancyId = null
	state.pendingDeleteMode = null
	closeModal(elements.deleteVacancyModal, () => {
		if (elements.deleteVacancyTitle) {
			elements.deleteVacancyTitle.textContent = 'Удалить вакансию?'
		}
		elements.confirmDeleteVacancyButton.textContent = 'Удалить'
		syncModalState()
	})
}

function handleDocumentClick(event) {
	if (
		state.infoPanelOpen &&
		!event.target.closest('#infoDockButton') &&
		!event.target.closest('#infoDockPanel')
	) {
		closeInfoPanel()
	}

	if (event.target.closest('[data-close-delete-modal]')) {
		closeDeleteVacancyModal()
		return
	}

	if (event.target.closest('[data-close-reset-modal]')) {
		closeResetVacancyModal()
		return
	}

	if (event.target.closest('[data-close-trash-modal]')) {
		closeTrashModal()
	}
}

function handleDocumentKeydown(event) {
	if (event.key === 'Escape' && state.infoPanelOpen) {
		closeInfoPanel()
	}

	if (event.key === 'Escape' && !elements.deleteVacancyModal?.hidden) {
		closeDeleteVacancyModal()
		return
	}

	if (event.key === 'Escape' && !elements.resetVacancyModal?.hidden) {
		closeResetVacancyModal()
		return
	}

	if (event.key === 'Escape' && !elements.trashModal?.hidden) {
		closeTrashModal()
	}
}

async function handleOpenTrash() {
	await refreshTrashVacancies()
	openTrashModal()
}

function openTrashModal() {
	if (!elements.trashModal) return

	openModal(elements.trashModal)
	syncModalState()
}

function closeTrashModal() {
	if (!elements.trashModal) return

	closeModal(elements.trashModal, () => {
		syncModalState()
	})
}

function handleEmptyTrashClick() {
	if (!state.trashVacancies.length || !elements.deleteVacancyModal || !elements.deleteVacancyText) {
		return
	}

	state.pendingDeleteVacancyId = 0
	state.pendingDeleteMode = 'empty-trash'
	if (elements.deleteVacancyTitle) {
		elements.deleteVacancyTitle.textContent = 'Очистить корзину?'
	}
	elements.confirmDeleteVacancyButton.textContent = 'Очистить корзину'
	elements.deleteVacancyText.textContent =
		'Все вакансии из корзины будут удалены навсегда без возможности восстановления.'
	openModal(elements.deleteVacancyModal)
	syncModalState()
}

function syncModalState() {
	const hasOpenModal =
		(elements.deleteVacancyModal && !elements.deleteVacancyModal.hidden) ||
		(elements.resetVacancyModal && !elements.resetVacancyModal.hidden) ||
		(elements.trashModal && !elements.trashModal.hidden)

	document.body.classList.toggle('admin-modal-open', Boolean(hasOpenModal))
}

function handleResetVacancyClick() {
	if (state.selectedVacancyId) {
		openResetVacancyModal()
		return
	}

	resetVacancyForm()
}

function openResetVacancyModal() {
	if (!elements.resetVacancyModal) return

	state.pendingVacancyReset = true
	openModal(elements.resetVacancyModal)
	syncModalState()
}

function closeResetVacancyModal() {
	if (!elements.resetVacancyModal) return

	state.pendingVacancyReset = false
	closeModal(elements.resetVacancyModal, () => {
		syncModalState()
	})
}

function openModal(modal) {
	if (!modal) return

	if (modal.dataset.closeTimer) {
		window.clearTimeout(Number(modal.dataset.closeTimer))
		delete modal.dataset.closeTimer
	}

	if (modal.dataset.openRaf) {
		window.cancelAnimationFrame(Number(modal.dataset.openRaf))
		delete modal.dataset.openRaf
	}

	modal.hidden = false
	modal.classList.remove('is-closing')
	modal.classList.remove('is-open')
	void modal.offsetHeight
	modal.dataset.openRaf = String(
		window.requestAnimationFrame(() => {
			modal.dataset.openRaf = String(
				window.requestAnimationFrame(() => {
					modal.classList.add('is-open')
					delete modal.dataset.openRaf
				})
			)
		})
	)
}

function closeModal(modal, onClosed) {
	if (!modal || modal.hidden) return

	if (modal.dataset.openRaf) {
		window.cancelAnimationFrame(Number(modal.dataset.openRaf))
		delete modal.dataset.openRaf
	}

	modal.classList.remove('is-open')
	modal.classList.add('is-closing')

	if (modal.dataset.closeTimer) {
		window.clearTimeout(Number(modal.dataset.closeTimer))
	}

	modal.dataset.closeTimer = String(
		window.setTimeout(() => {
			modal.hidden = true
			modal.classList.remove('is-closing')
			delete modal.dataset.closeTimer
			if (typeof onClosed === 'function') {
				onClosed()
			}
		}, 220)
	)
}

function confirmVacancyReset() {
	if (!state.pendingVacancyReset) return

	closeResetVacancyModal()
	resetVacancyForm()
}

async function handleRestoreVacancy(id) {
	const restoreButton = document.querySelector(
		`[data-trash-action="restore"][data-id="${id}"]`
	)
	setButtonLoading(restoreButton, true)
	setVacancyStatus('Восстанавливаю вакансию...')

	try {
		await api(`/api/admin/vacancies/${id}/restore`, { method: 'PUT' })
		await Promise.all([refreshVacancies(), refreshTrashVacancies()])
		setVacancyStatus('Вакансия восстановлена.')
		showToast('Вакансия восстановлена.')
	} catch (error) {
		console.error(error)
		const message = getErrorMessage(error, 'Не удалось восстановить вакансию.')
		setVacancyStatus(message, true)
		showToast(message, 'error')
	} finally {
		setButtonLoading(restoreButton, false)
	}
}

async function moveVacancy(id, direction) {
	const button = document.querySelector(
		`[data-action="${direction < 0 ? 'move-up' : 'move-down'}"][data-id="${id}"]`
	)
	setButtonLoading(button, true)
	const currentIndex = state.vacancies.findIndex(vacancy => vacancy.id === id)
	if (currentIndex === -1) {
		setButtonLoading(button, false)
		return
	}

	const nextIndex = currentIndex + direction
	if (nextIndex < 0 || nextIndex >= state.vacancies.length) {
		setButtonLoading(button, false)
		return
	}

	const nextVacancies = [...state.vacancies]
	;[nextVacancies[currentIndex], nextVacancies[nextIndex]] = [
		nextVacancies[nextIndex],
		nextVacancies[currentIndex],
	]

	state.vacancies = nextVacancies
	renderVacancies()
	setVacancyStatus('Сохраняю порядок вакансий...')

	try {
		const vacancies = await api('/api/admin/vacancies/order', {
			method: 'PUT',
			body: JSON.stringify({
				orderedIds: nextVacancies.map(vacancy => vacancy.id),
			}),
		})

		state.vacancies = vacancies
		renderVacancies()
		setVacancyStatus('Порядок вакансий сохранён.')
		showToast('Порядок вакансий сохранён.')
	} catch (error) {
		console.error(error)
		await refreshVacancies()
		const message = getErrorMessage(error, 'Не удалось изменить порядок вакансий.')
		setVacancyStatus(message, true)
		showToast(message, 'error')
	} finally {
		setButtonLoading(button, false)
	}
}

async function updateVacancyActive(id, active, toggle) {
	const vacancy = findVacancy(id)
	if (!vacancy) return

	const previousActive = vacancy.active
	vacancy.active = active
	renderVacancies()

	try {
		await api(`/api/admin/vacancies/${id}`, {
			method: 'PUT',
			body: JSON.stringify({
				title: vacancy.title,
				salary: vacancy.salary,
				summary: vacancy.summary || '',
				schedule: vacancy.schedule || '',
				duties: vacancy.duties || '',
				requirements: vacancy.requirements || '',
				conditions: vacancy.conditions || '',
				active,
			}),
		})

		if (state.selectedVacancyId === id) {
			const selected = findVacancy(id)
			if (selected) fillVacancyForm(selected)
		}

		showToast(
			active ? 'Вакансия опубликована на сайте.' : 'Вакансия скрыта с сайта.'
		)
	} catch (error) {
		console.error(error)
		vacancy.active = previousActive
		renderVacancies()
		if (toggle) toggle.checked = previousActive
		showToast(getErrorMessage(error, 'Не удалось изменить публикацию вакансии.'), 'error')
	}
}

function fillVacancyForm(vacancy) {
	if (!hasVacancyUI()) return

	state.selectedVacancyId = vacancy.id

	elements.vacancyForm.elements.namedItem('id').value = String(vacancy.id)
	elements.vacancyForm.elements.namedItem('title').value = vacancy.title || ''
	elements.vacancyForm.elements.namedItem('salary').value = vacancy.salary || ''
	setListEditorItems('schedule', vacancy.scheduleLines || splitLines(vacancy.schedule))
	setListEditorItems('duties', vacancy.dutiesList || splitLines(vacancy.duties))
	setListEditorItems(
		'requirements',
		vacancy.requirementsList || splitLines(vacancy.requirements)
	)
	setListEditorItems(
		'conditions',
		vacancy.conditionsList || splitLines(vacancy.conditions)
	)
	elements.vacancyFormTitle.innerHTML = `Редактирование: <span class="admin-badge admin-badge_editor">${escapeHtml(vacancy.title)}</span>`

	renderVacancies()
}

function resetVacancyForm() {
	if (!hasVacancyUI()) return

	state.selectedVacancyId = null
	elements.vacancyForm.reset()
	elements.vacancyForm.elements.namedItem('id').value = ''
	resetListEditors()
	elements.vacancyFormTitle.textContent = 'Создание новой вакансии'
	setVacancyStatus('')
	renderVacancies()
}

function handleVacancyFormClick(event) {
	const addButton = event.target.closest('[data-add-list-item]')
	if (addButton) {
		addListEditorItem(addButton.dataset.addListItem)
		return
	}

	const removeButton = event.target.closest('[data-remove-list-item]')
	if (removeButton) {
		removeListEditorItem(removeButton.dataset.removeListItem, removeButton)
	}
}

function findVacancy(id) {
	return state.vacancies.find(vacancy => vacancy.id === id) || null
}

function getVacancyPreviewText(vacancy) {
	const scheduleLines = Array.isArray(vacancy.scheduleLines)
		? vacancy.scheduleLines
		: splitLines(vacancy.schedule)

	if (scheduleLines.length) {
		const preview = scheduleLines
			.slice(0, 2)
			.map((line) => line.replace(/^\s*[-–—•]+\s*/, '').trim())
			.filter(Boolean)
			.join(' • ')
		return preview.length > 140 ? preview.slice(0, 137) + '...' : preview
	}

	if (readText(vacancy.summary) !== '') {
		return vacancy.summary
	}

	return 'Описание вакансии не заполнено.'
}

async function handleContactsSubmit(event) {
	if (event) {
		event.preventDefault()
	}
	const submitButton =
		event?.type === 'click' && event.currentTarget instanceof HTMLElement
			? event.currentTarget
			: elements.saveButton
	const formData = new FormData(elements.contactsForm)

	elements.saveButton.disabled = true
	setButtonLoading(submitButton, true)
	setStatus('Сохраняю...')

	try {
		const coordinates = Array.isArray(state.adminMapCoordinates)
			? state.adminMapCoordinates
			: [56.334612, 44.103409]

		await api('/api/admin/contacts', {
			method: 'PUT',
			body: JSON.stringify({
				phones: joinListEditorItems('phones'),
				email: readText(formData.get('email')),
				address: state.adminMapAddress,
				mapLatitude: coordinates[0],
				mapLongitude: coordinates[1],
				mapUrl: readText(formData.get('mapUrl')),
				vk: readText(formData.get('vk')),
				telegram: readText(formData.get('telegram')),
				whatsapp: readText(formData.get('whatsapp')),
			}),
		})

		setStatus('Контакты сохранены.')
		showToast('Контакты сохранены.')
	} catch (error) {
		console.error(error)
		const message = getErrorMessage(error, 'Не удалось сохранить контакты.')
		setStatus(message, true)
		showToast(message, 'error')
	} finally {
		elements.saveButton.disabled = false
		setButtonLoading(submitButton, false)
	}
}

function handleContactsFormClick(event) {
	const addButton = event.target.closest('[data-add-list-item="phones"]')
	if (addButton) {
		addListEditorItem('phones')
		return
	}

	const removeButton = event.target.closest('[data-remove-list-item="phones"]')
	if (removeButton) {
		removeListEditorItem('phones', removeButton)
	}
}

async function handleLogout() {
	setButtonLoading(elements.logoutButton, true)
	try {
		await api('/admin/logout', { method: 'POST' }, false)
	} finally {
		setButtonLoading(elements.logoutButton, false)
		window.location.href = '/admin/login'
	}
}

async function api(url, options = {}, expectJson = true) {
	const response = await fetch(url, {
		headers: {
			'Content-Type': 'application/json',
			...(options.headers || {}),
		},
		credentials: 'same-origin',
		...options,
	})

	if (!response.ok) {
		if (response.status === 401) {
			window.location.href = '/admin/login'
			throw new Error('Unauthorized')
		}

		const contentType = response.headers.get('Content-Type') || ''
		if (contentType.includes('application/json')) {
			const payload = await response.json()
			throw new Error(payload.error || `Request failed: ${response.status}`)
		}

		throw new Error(`Request failed: ${response.status}`)
	}

	if (!expectJson || response.status === 204) return null
	return response.json()
}

function runStartupTask(id, label, task) {
	startLoader(id, label)

	return Promise.resolve()
		.then(() => task())
		.then(result => {
			completeLoader(id, 'Готово')
			return result
		})
		.catch(error => {
			failLoader(id, getErrorMessage(error, 'Ошибка загрузки'))
			throw error
		})
}

function startLoader(id, label) {
	if (!elements.loaderStack) return

	const existing = state.loaders.get(id)
	if (existing) {
		window.clearInterval(existing.timerId)
		existing.node.remove()
		state.loaders.delete(id)
	}

	const node = document.createElement('article')
	node.className = 'admin-loader-card'
	node.dataset.loaderId = id
	node.innerHTML = `
		<div class="admin-loader-card__header">
			<span class="admin-loader-card__status">Загрузка...</span>
		</div>
		<h3 class="admin-loader-card__title">${escapeHtml(label)}</h3>
		<div
			class="admin-loader-card__progress"
			role="progressbar"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow="6"
		>
			<div class="admin-loader-card__bar"></div>
		</div>
		<div class="admin-loader-card__meta">
			<span class="admin-loader-card__phase">Подключение</span>
			<span class="admin-loader-card__percent">6%</span>
		</div>
	`

	elements.loaderStack.prepend(node)

	const loader = {
		id,
		node,
		label,
		progress: 6,
		timerId: 0,
	}

	state.loaders.set(id, loader)
	updateLoader(id)

	loader.timerId = window.setInterval(() => advanceLoader(id), 120)
}

function advanceLoader(id) {
	const loader = state.loaders.get(id)
	if (!loader) return

	const next = Math.min(
		86,
		loader.progress + (loader.progress < 24 ? 7 : loader.progress < 56 ? 4 : 2)
	)
	if (next === loader.progress) return

	loader.progress = next
	updateLoader(id)
}

function completeLoader(id, phase = 'Готово') {
	const loader = state.loaders.get(id)
	if (!loader) return

	window.clearInterval(loader.timerId)
	loader.progress = 100
	loader.node.classList.add('is-complete')
	updateLoader(id, phase)

	window.setTimeout(() => {
		loader.node.classList.add('is-leaving')
		window.setTimeout(() => {
			loader.node.remove()
			state.loaders.delete(id)
		}, 220)
	}, 450)
}

function failLoader(id, message) {
	const loader = state.loaders.get(id)
	if (!loader) return

	window.clearInterval(loader.timerId)
	loader.progress = Math.max(loader.progress, 100)
	loader.node.classList.add('is-error')
	updateLoader(id, message)

	window.setTimeout(() => {
		loader.node.classList.add('is-leaving')
		window.setTimeout(() => {
			loader.node.remove()
			state.loaders.delete(id)
		}, 2600)
	}, 1600)
}

function updateLoader(id, phaseOverride) {
	const loader = state.loaders.get(id)
	if (!loader) return

	const progressbar = loader.node.querySelector('.admin-loader-card__progress')
	const bar = loader.node.querySelector('.admin-loader-card__bar')
	const percent = loader.node.querySelector('.admin-loader-card__percent')
	const phase = loader.node.querySelector('.admin-loader-card__phase')
	const status = loader.node.querySelector('.admin-loader-card__status')

	if (progressbar) {
		progressbar.setAttribute('aria-valuenow', String(loader.progress))
	}
	if (bar) {
		bar.style.width = `${loader.progress}%`
	}
	if (percent) {
		percent.textContent = `${loader.progress}%`
	}

	const phaseText =
		phaseOverride ||
		(loader.progress < 20
			? 'Подключение'
			: loader.progress < 52
				? 'Получение данных'
				: loader.progress < 88
					? 'Обработка'
					: 'Завершение')

	if (phase) {
		phase.textContent = phaseText
	}
	if (status) {
		status.textContent = loader.node.classList.contains('is-error')
			? 'Ошибка'
			: loader.node.classList.contains('is-complete')
				? 'Завершено'
				: 'Запрос...'
	}
}

function readText(value) {
	return String(value ?? '').trim()
}

function setButtonLoading(button, isLoading) {
	if (!(button instanceof HTMLElement)) return

	button.classList.toggle('is-loading', isLoading)
}

function initTheme() {
	applyTheme(state.themeMode)
	updateThemeSwitcherUI()
	themeMediaQuery.addEventListener('change', handleSystemThemeChange)
}

function handleSystemThemeChange() {
	if (state.themeMode !== 'system') return
	applyTheme('system')
}

function applyTheme(mode) {
	state.themeMode = mode
	const resolved =
		mode === 'system'
			? themeMediaQuery.matches
				? 'dark'
				: 'light'
			: mode

	document.documentElement.dataset.themeMode = mode
	document.documentElement.dataset.theme = resolved
	document.documentElement.style.colorScheme = resolved
	localStorage.setItem('admin-theme-mode', mode)
	updateThemeSwitcherUI()
}

function updateThemeSwitcherUI() {
	if (!elements.themeSwitcher) return

	elements.themeSwitcher.querySelectorAll('[data-theme-mode]').forEach(button => {
		button.classList.toggle('is-active', button.dataset.themeMode === state.themeMode)
	})

	if (elements.themeSystemButton) {
		elements.themeSystemButton.classList.toggle('is-active', state.themeMode === 'system')
	}
}

function handleThemeSwitcherClick(event) {
	const button = event.target.closest('[data-theme-mode]')
	if (!button) return

	applyTheme(button.dataset.themeMode || 'system')
}

function handleThemeSystemClick() {
	applyTheme('system')
}

function toggleInfoPanel() {
	if (state.infoPanelOpen) {
		closeInfoPanel()
		return
	}

	openInfoPanel()
}

function openInfoPanel() {
	if (!elements.infoDockPanel || !elements.infoDockButton) return

	state.infoPanelOpen = true
	elements.infoDockPanel.hidden = false
	elements.infoDockButton.setAttribute('aria-expanded', 'true')
}

function closeInfoPanel() {
	if (!elements.infoDockPanel || !elements.infoDockButton) return

	state.infoPanelOpen = false
	elements.infoDockPanel.hidden = true
	elements.infoDockButton.setAttribute('aria-expanded', 'false')
}

function buildMapURL(latitude, longitude) {
	return `https://yandex.ru/maps/?ll=${longitude}%2C${latitude}&z=17&pt=${longitude},${latitude},pm2rdm`
}

function setStatus(message, isError = false) {
	if (!elements.statusMessage) return

	elements.statusMessage.textContent = message
	elements.statusMessage.classList.toggle('is-error', isError)
}

function setVacancyStatus(message, isError = false) {
	if (!elements.vacancyStatusMessage) return

	elements.vacancyStatusMessage.textContent = message
	elements.vacancyStatusMessage.classList.toggle('is-error', isError)
}

function setUserStatus(message, isError = false) {
	if (!elements.userStatusMessage) return

	elements.userStatusMessage.textContent = message
	elements.userStatusMessage.classList.toggle('is-error', isError)
}

function showToast(message, type = 'success') {
	if (!elements.toastStack || !message) return

	const duration = 3200
	const toast = document.createElement('div')
	toast.className = `admin-toast admin-toast_${type}`
	toast.textContent = message
	toast.style.setProperty('--toast-duration', `${duration}ms`)
	elements.toastStack.appendChild(toast)

	window.setTimeout(() => {
		toast.classList.add('is-leaving')
		window.setTimeout(() => {
			toast.remove()
		}, 240)
	}, duration)
}

function hasVacancyUI() {
	return Boolean(
		elements.vacanciesList &&
			elements.vacanciesEmpty &&
			elements.trashVacanciesList &&
			elements.trashEmpty &&
			elements.emptyTrashButton &&
			elements.vacancyForm &&
			elements.vacancyFormTitle &&
			elements.vacancyStatusMessage &&
			elements.saveVacancyButton &&
			elements.resetVacancyButton &&
			elements.createVacancyButton &&
			elements.listEditors.schedule &&
			elements.listEditors.duties &&
			elements.listEditors.requirements &&
			elements.listEditors.conditions
	)
}

function hasUsersUI() {
	return Boolean(
		elements.usersList &&
			elements.usersEmpty &&
			elements.userForm &&
			elements.userFormTitle &&
			elements.userStatusMessage &&
			elements.saveUserButton &&
			elements.resetUserButton &&
			elements.createUserButton
	)
}

function hasMetricsUI() {
	return Boolean(
		elements.metricsVacanciesList &&
			elements.metricsVacanciesEmpty &&
			elements.metricsDailyList &&
			elements.metricsDailyEmpty &&
			elements.metricsEventsList &&
			elements.metricsEventsEmpty &&
			elements.metricTotalViews &&
			elements.metricTodayViews &&
			elements.metricUniqueIps
	)
}

function fillUserForm(user) {
	if (!hasUsersUI()) return

	state.selectedUserId = user.id
	elements.userForm.elements.namedItem('id').value = user.id
	elements.userForm.elements.namedItem('login').value = user.login || ''
	const passwordField = elements.userForm.elements.namedItem('password')
	const roleField = elements.userForm.elements.namedItem('role')
	restoreRoleFieldOptions(roleField)
	passwordField.value = ''
	roleField.value = user.role || 'admin'
	const activeField = elements.userForm.elements.namedItem('active')
	activeField.checked = Boolean(user.active)
	activeField.disabled = Boolean(user.isRoot)
	activeField.title =
		user.isRoot
			? 'Недоступно для главного пользователя.'
			: ''
	passwordField.disabled = Boolean(user.isRoot)
	roleField.disabled = Boolean(user.isRoot)
	passwordField.placeholder =
		user.isRoot
			? 'Смена пароля недоступна для главного пользователя'
			: 'Введите новый пароль'
	passwordField.title =
		user.isRoot
			? 'Смена пароля недоступна для главного пользователя.'
			: ''
	roleField.title =
		user.isRoot
			? 'Смена роли недоступна для главного пользователя.'
			: ''
	if (user.isRoot) {
		replaceRoleFieldWithLockedMessage(roleField)
	}
	elements.userFormTitle.textContent = `Редактирование: ${user.login}`
	renderUsers()
}

function resetUserForm() {
	if (!hasUsersUI()) return

	state.selectedUserId = null
	elements.userForm.reset()
	elements.userForm.elements.namedItem('id').value = ''
	const passwordField = elements.userForm.elements.namedItem('password')
	const roleField = elements.userForm.elements.namedItem('role')
	restoreRoleFieldOptions(roleField)
	roleField.value = 'admin'
	roleField.disabled = false
	roleField.title = ''
	passwordField.disabled = false
	passwordField.placeholder = 'Введите новый пароль'
	passwordField.title = ''
	const activeField = elements.userForm.elements.namedItem('active')
	activeField.checked = true
	activeField.disabled = false
	activeField.title = ''
	elements.userFormTitle.textContent = 'Создание новой учетной записи'
	setUserStatus('')
	renderUsers()
}

function replaceRoleFieldWithLockedMessage(roleField) {
	if (!(roleField instanceof HTMLSelectElement)) return
	if (!roleField.dataset.originalOptions) {
		roleField.dataset.originalOptions = roleField.innerHTML
	}

	roleField.innerHTML =
		'<option value="admin">Смена роли недоступна для главного пользователя</option>'
	roleField.value = 'admin'
}

function restoreRoleFieldOptions(roleField) {
	if (!(roleField instanceof HTMLSelectElement)) return
	if (!roleField.dataset.originalOptions) return

	roleField.innerHTML = roleField.dataset.originalOptions
}

function findUser(id) {
	return state.users.find(user => user.id === id) || null
}

function getRoleLabel(role) {
	switch (role) {
		case 'admin':
			return 'Администратор'
		case 'hr':
			return 'HR'
		default:
			return role || 'Роль не указана'
	}
}

function formatNumber(value) {
	return new Intl.NumberFormat('ru-RU').format(Number(value) || 0)
}

function trimUserAgent(value) {
	const normalized = readText(value)
	if (normalized === '') return 'User-Agent не передан'
	if (normalized.length <= 120) return normalized
	return normalized.slice(0, 117) + '...'
}

function getMetricsSegmentColor(vacancyId) {
	const palette = [
		'#708896',
		'#0ea5b7',
		'#22c55e',
		'#3b82f6',
		'#f59e0b',
		'#ef4444',
		'#8b5cf6',
		'#64748b',
		'#14b8a6',
		'#2563eb',
		'#7c3aed',
		'#f97316',
		'#84cc16',
		'#d946ef',
		'#06b6d4',
		'#65a30d',
		'#dc2626',
		'#475569',
	]

	const index = Math.abs(Number(vacancyId) || 0) % palette.length
	return palette[index]
}

function setListEditorItems(name, items) {
	const editor = elements.listEditors[name]
	if (!editor) return

	editor.innerHTML = ''
	const normalized = items.filter(item => readText(item) !== '')
	if (!normalized.length) {
		editor.appendChild(createListEditorRow(name, ''))
		return
	}

	normalized.forEach(item => {
		editor.appendChild(createListEditorRow(name, item))
	})
}

function addListEditorItem(name, value = '') {
	const editor = elements.listEditors[name]
	if (!editor) return

	editor.appendChild(createListEditorRow(name, value))
	const input = editor.lastElementChild?.querySelector('input')
	if (input) input.focus()
}

function removeListEditorItem(name, button) {
	const editor = elements.listEditors[name]
	const row = button.closest('.admin-list-editor__row')
	if (!editor || !row) return

	if (editor.children.length === 1) {
		const input = row.querySelector('input')
		if (input) input.value = ''
		return
	}

	row.remove()
}

function joinListEditorItems(name) {
	const editor = elements.listEditors[name]
	if (!editor) return ''

	return Array.from(editor.querySelectorAll('input'))
		.map(input => readText(input.value))
		.filter(Boolean)
		.join('\n')
}

function resetListEditors() {
	Object.keys(elements.listEditors).forEach(name => {
		setListEditorItems(name, [])
	})
}

function createListEditorRow(name, value) {
	const row = document.createElement('div')
	row.className = 'admin-list-editor__row'
	row.innerHTML = `
		<input
			class="admin-input"
			type="text"
			value="${escapeAttribute(value)}"
			placeholder="Введите пункт"
		/>
		<button
			class="admin-btn admin-btn_compact admin-btn_danger"
			data-remove-list-item="${name}"
			type="button"
		>
			Удалить
		</button>
	`
	return row
}

function splitLines(value) {
	return String(value || '')
		.split('\n')
		.map(line => readText(line))
		.filter(Boolean)
}

function getErrorMessage(error, fallback) {
	if (error instanceof Error && error.message && error.message !== 'Unauthorized') {
		return error.message
	}
	return fallback
}

function escapeHtml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

function escapeAttribute(value) {
	return escapeHtml(value)
}
