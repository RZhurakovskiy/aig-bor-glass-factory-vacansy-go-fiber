const elements = {
	contactsForm: document.getElementById('contactsForm'),
	logoutButton: document.getElementById('logoutButton'),
	saveButton: document.getElementById('saveButton'),
	statusMessage: document.getElementById('statusMessage'),
	toastStack: document.getElementById('toastStack'),
	vacanciesList: document.getElementById('vacanciesList'),
	vacanciesEmpty: document.getElementById('vacanciesEmpty'),
	openTrashButton: document.getElementById('openTrashButton'),
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
	deleteVacancyModal: document.getElementById('deleteVacancyModal'),
	deleteVacancyTitle: document.getElementById('deleteVacancyTitle'),
	deleteVacancyText: document.getElementById('deleteVacancyText'),
	confirmDeleteVacancyButton: document.getElementById('confirmDeleteVacancyButton'),
	cancelDeleteVacancyButton: document.getElementById('cancelDeleteVacancyButton'),
	listEditors: {
		schedule: document.querySelector('[data-list-editor="schedule"]'),
		duties: document.querySelector('[data-list-editor="duties"]'),
		requirements: document.querySelector('[data-list-editor="requirements"]'),
		conditions: document.querySelector('[data-list-editor="conditions"]'),
	},
}

const state = {
	vacancies: [],
	trashVacancies: [],
	contactsAddress: '',
	selectedVacancyId: null,
	pendingDeleteVacancyId: null,
	pendingDeleteMode: null,
}

bootstrap().catch(error => {
	console.error(error)
	setStatus('Не удалось загрузить контакты.', true)
	setVacancyStatus('Не удалось загрузить вакансии.', true)
	showToast('Не удалось загрузить данные админки.', 'error')
})

async function bootstrap() {
	bindEvents()
	const tasks = []

	if (elements.contactsForm) {
		tasks.push(refreshContacts())
	}

	if (hasVacancyUI()) {
		tasks.push(refreshVacancies())
	}

	await Promise.all(tasks)
}

function bindEvents() {
	if (elements.contactsForm) {
		elements.contactsForm.addEventListener('submit', handleContactsSubmit)
	}
	if (elements.saveButton) {
		elements.saveButton.addEventListener('click', handleContactsSubmit)
	}

	if (elements.logoutButton) {
		elements.logoutButton.addEventListener('click', handleLogout)
	}

	if (elements.confirmDeleteVacancyButton) {
		elements.confirmDeleteVacancyButton.addEventListener('click', confirmVacancyDelete)
	}

	if (elements.cancelDeleteVacancyButton) {
		elements.cancelDeleteVacancyButton.addEventListener('click', closeDeleteVacancyModal)
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

	if (hasVacancyUI()) {
		elements.vacancyForm.addEventListener('submit', handleVacancySubmit)
		elements.saveVacancyButton.addEventListener('click', handleVacancySubmit)
		elements.resetVacancyButton.addEventListener('click', resetVacancyForm)
		elements.createVacancyButton.addEventListener('click', resetVacancyForm)
		elements.vacancyForm.addEventListener('click', handleVacancyFormClick)
		elements.vacanciesList.addEventListener('click', handleVacancyListClick)
		elements.trashVacanciesList.addEventListener('click', handleTrashListClick)
	}

	document.addEventListener('click', handleDocumentClick)
	document.addEventListener('keydown', handleDocumentKeydown)
}

async function refreshContacts() {
	const contacts = await api('/api/admin/contacts')

	state.contactsAddress = contacts.address || ''
	elements.contactsForm.elements.namedItem('phones').value = contacts.phones || ''
	elements.contactsForm.elements.namedItem('email').value = contacts.email || ''
	elements.contactsForm.elements.namedItem('vk').value = contacts.vk || ''
	elements.contactsForm.elements.namedItem('telegram').value =
		contacts.telegram || ''
	elements.contactsForm.elements.namedItem('whatsapp').value =
		contacts.whatsapp || ''
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

		const summary = vacancy.summary
			? escapeHtml(vacancy.summary)
			: 'Краткое описание не заполнено.'

		item.innerHTML = `
			<div class="admin-vacancy-card__content">
				<div class="admin-vacancy-card__meta">
					<span class="admin-badge ${
						vacancy.active ? 'admin-badge_success' : 'admin-badge_muted'
					}">
						${vacancy.active ? 'Опубликована' : 'Скрыта'}
					</span>
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

async function handleVacancySubmit(event) {
	if (event) {
		event.preventDefault()
	}

	const formData = new FormData(elements.vacancyForm)
	const vacancyId = Number(formData.get('id') || 0)
	const payload = {
		title: readText(formData.get('title')),
		salary: readText(formData.get('salary')),
		summary: '',
		schedule: joinListEditorItems('schedule'),
		duties: joinListEditorItems('duties'),
		requirements: joinListEditorItems('requirements'),
		conditions: joinListEditorItems('conditions'),
		active: elements.vacancyForm.elements.namedItem('active').checked,
	}

	elements.saveVacancyButton.disabled = true
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
	elements.deleteVacancyModal.hidden = false
	syncModalState()
}

function closeDeleteVacancyModal() {
	if (!elements.deleteVacancyModal) return

	state.pendingDeleteVacancyId = null
	state.pendingDeleteMode = null
	if (elements.deleteVacancyTitle) {
		elements.deleteVacancyTitle.textContent = 'Удалить вакансию?'
	}
	elements.confirmDeleteVacancyButton.textContent = 'Удалить'
	elements.deleteVacancyModal.hidden = true
	syncModalState()
}

function handleDocumentClick(event) {
	if (event.target.closest('[data-close-delete-modal]')) {
		closeDeleteVacancyModal()
		return
	}

	if (event.target.closest('[data-close-trash-modal]')) {
		closeTrashModal()
	}
}

function handleDocumentKeydown(event) {
	if (event.key === 'Escape' && !elements.deleteVacancyModal?.hidden) {
		closeDeleteVacancyModal()
		return
	}

	if (event.key === 'Escape' && !elements.trashModal?.hidden) {
		closeTrashModal()
	}
}

async function handleOpenTrash() {
	openTrashModal()
	await refreshTrashVacancies()
}

function openTrashModal() {
	if (!elements.trashModal) return

	elements.trashModal.hidden = false
	syncModalState()
}

function closeTrashModal() {
	if (!elements.trashModal) return

	elements.trashModal.hidden = true
	syncModalState()
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
	elements.deleteVacancyModal.hidden = false
	syncModalState()
}

function syncModalState() {
	const hasOpenModal =
		(elements.deleteVacancyModal && !elements.deleteVacancyModal.hidden) ||
		(elements.trashModal && !elements.trashModal.hidden)

	document.body.classList.toggle('admin-modal-open', Boolean(hasOpenModal))
}

async function handleRestoreVacancy(id) {
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
	}
}

async function moveVacancy(id, direction) {
	const currentIndex = state.vacancies.findIndex(vacancy => vacancy.id === id)
	if (currentIndex === -1) return

	const nextIndex = currentIndex + direction
	if (nextIndex < 0 || nextIndex >= state.vacancies.length) return

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
	elements.vacancyForm.elements.namedItem('active').checked = Boolean(vacancy.active)
	elements.vacancyFormTitle.textContent = `Редактирование: ${vacancy.title}`

	renderVacancies()
}

function resetVacancyForm() {
	if (!hasVacancyUI()) return

	state.selectedVacancyId = null
	elements.vacancyForm.reset()
	elements.vacancyForm.elements.namedItem('id').value = ''
	elements.vacancyForm.elements.namedItem('active').checked = true
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

async function handleContactsSubmit(event) {
	if (event) {
		event.preventDefault()
	}
	const formData = new FormData(elements.contactsForm)

	elements.saveButton.disabled = true
	setStatus('Сохраняю...')

	try {
		await api('/api/admin/contacts', {
			method: 'PUT',
			body: JSON.stringify({
				phones: readText(formData.get('phones')),
				email: readText(formData.get('email')),
				address: state.contactsAddress,
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
	}
}

async function handleLogout() {
	try {
		await api('/admin/logout', { method: 'POST' }, false)
	} finally {
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

function readText(value) {
	return String(value ?? '').trim()
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
