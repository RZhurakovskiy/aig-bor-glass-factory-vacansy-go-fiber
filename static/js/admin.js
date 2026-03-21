const elements = {
	contactsForm: document.getElementById('contactsForm'),
	logoutButton: document.getElementById('logoutButton'),
	saveButton: document.getElementById('saveButton'),
	statusMessage: document.getElementById('statusMessage'),
	vacanciesList: document.getElementById('vacanciesList'),
	vacanciesEmpty: document.getElementById('vacanciesEmpty'),
	vacancyForm: document.getElementById('vacancyForm'),
	vacancyFormTitle: document.getElementById('vacancyFormTitle'),
	vacancyStatusMessage: document.getElementById('vacancyStatusMessage'),
	saveVacancyButton: document.getElementById('saveVacancyButton'),
	resetVacancyButton: document.getElementById('resetVacancyButton'),
	createVacancyButton: document.getElementById('createVacancyButton'),
}

const state = {
	vacancies: [],
	selectedVacancyId: null,
}

bootstrap().catch(error => {
	console.error(error)
	setStatus('Не удалось загрузить контакты.', true)
	setVacancyStatus('Не удалось загрузить вакансии.', true)
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

	if (hasVacancyUI()) {
		elements.vacancyForm.addEventListener('submit', handleVacancySubmit)
		elements.saveVacancyButton.addEventListener('click', handleVacancySubmit)
		elements.resetVacancyButton.addEventListener('click', resetVacancyForm)
		elements.createVacancyButton.addEventListener('click', resetVacancyForm)
		elements.vacanciesList.addEventListener('click', handleVacancyListClick)
	}
}

async function refreshContacts() {
	const contacts = await api('/api/admin/contacts')

	elements.contactsForm.elements.namedItem('phones').value = contacts.phones || ''
	elements.contactsForm.elements.namedItem('email').value = contacts.email || ''
	elements.contactsForm.elements.namedItem('address').value = contacts.address || ''
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

async function handleVacancySubmit(event) {
	if (event) {
		event.preventDefault()
	}

	const formData = new FormData(elements.vacancyForm)
	const vacancyId = Number(formData.get('id') || 0)
	const payload = {
		title: readText(formData.get('title')),
		salary: readText(formData.get('salary')),
		summary: readText(formData.get('summary')),
		schedule: readText(formData.get('schedule')),
		duties: readText(formData.get('duties')),
		requirements: readText(formData.get('requirements')),
		conditions: readText(formData.get('conditions')),
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
		setVacancyStatus(vacancyId ? 'Вакансия сохранена.' : 'Вакансия создана.')
	} catch (error) {
		console.error(error)
		setVacancyStatus(getErrorMessage(error, 'Не удалось сохранить вакансию.'), true)
	} finally {
		elements.saveVacancyButton.disabled = false
	}
}

async function handleVacancyDelete(id) {
	const vacancy = findVacancy(id)
	if (!vacancy) return

	const confirmed = window.confirm(`Удалить вакансию «${vacancy.title}»?`)
	if (!confirmed) return

	setVacancyStatus('Удаляю вакансию...')

	try {
		await api(`/api/admin/vacancies/${id}`, { method: 'DELETE' })

		if (state.selectedVacancyId === id) {
			state.selectedVacancyId = null
		}

		await refreshVacancies()
		setVacancyStatus('Вакансия удалена.')
	} catch (error) {
		console.error(error)
		setVacancyStatus(getErrorMessage(error, 'Не удалось удалить вакансию.'), true)
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
	} catch (error) {
		console.error(error)
		await refreshVacancies()
		setVacancyStatus(
			getErrorMessage(error, 'Не удалось изменить порядок вакансий.'),
			true
		)
	}
}

function fillVacancyForm(vacancy) {
	if (!hasVacancyUI()) return

	state.selectedVacancyId = vacancy.id

	elements.vacancyForm.elements.namedItem('id').value = String(vacancy.id)
	elements.vacancyForm.elements.namedItem('title').value = vacancy.title || ''
	elements.vacancyForm.elements.namedItem('salary').value = vacancy.salary || ''
	elements.vacancyForm.elements.namedItem('summary').value = vacancy.summary || ''
	elements.vacancyForm.elements.namedItem('schedule').value = vacancy.schedule || ''
	elements.vacancyForm.elements.namedItem('duties').value = vacancy.duties || ''
	elements.vacancyForm.elements.namedItem('requirements').value =
		vacancy.requirements || ''
	elements.vacancyForm.elements.namedItem('conditions').value =
		vacancy.conditions || ''
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
	elements.vacancyFormTitle.textContent = 'Создание новой вакансии'
	setVacancyStatus('')
	renderVacancies()
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
				address: readText(formData.get('address')),
				vk: readText(formData.get('vk')),
				telegram: readText(formData.get('telegram')),
				whatsapp: readText(formData.get('whatsapp')),
			}),
		})

		setStatus('Контакты сохранены.')
	} catch (error) {
		console.error(error)
		setStatus(getErrorMessage(error, 'Не удалось сохранить контакты.'), true)
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

function hasVacancyUI() {
	return Boolean(
		elements.vacanciesList &&
			elements.vacanciesEmpty &&
			elements.vacancyForm &&
			elements.vacancyFormTitle &&
			elements.vacancyStatusMessage &&
			elements.saveVacancyButton &&
			elements.resetVacancyButton &&
			elements.createVacancyButton
	)
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
