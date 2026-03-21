const elements = {
	contactsForm: document.getElementById('contactsForm'),
	logoutButton: document.getElementById('logoutButton'),
	saveButton: document.getElementById('saveButton'),
	statusMessage: document.getElementById('statusMessage'),
}

bootstrap().catch(error => {
	console.error(error)
	setStatus('Не удалось загрузить контакты.', true)
})

async function bootstrap() {
	bindEvents()
	await refreshContacts()
}

function bindEvents() {
	elements.contactsForm.addEventListener('submit', handleContactsSubmit)
	elements.logoutButton.addEventListener('click', handleLogout)
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

async function handleContactsSubmit(event) {
	event.preventDefault()
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
		setStatus('Не удалось сохранить контакты.', true)
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

		const text = await response.text()
		throw new Error(text || `Request failed: ${response.status}`)
	}

	if (!expectJson || response.status === 204) return null
	return response.json()
}

function readText(value) {
	return String(value ?? '').trim()
}

function setStatus(message, isError = false) {
	elements.statusMessage.textContent = message
	elements.statusMessage.classList.toggle('is-error', isError)
}
