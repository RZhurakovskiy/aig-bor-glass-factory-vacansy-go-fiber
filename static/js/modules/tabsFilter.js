export function tabsFilter() {
	const buttons = document.querySelectorAll('.tab-button')
	const contents = document.querySelectorAll('.vacancy-card')
	const wrapper = document.querySelector('.vacancy-card__item')
	const select = document.getElementById('vacancy-select')

	function normalizeString(str) {
		return str?.replace(/\s+/g, ' ').trim().toLowerCase()
	}

	function emitActiveVacancyChange(card) {
		if (!card) return

		document.dispatchEvent(
			new CustomEvent('vacancy:active-change', {
				detail: {
					vacancyId: card.getAttribute('data-vacancy-id') || '',
				},
			})
		)
	}

	if (buttons.length > 0 && contents.length > 0) {
		buttons[0].classList.add('active')
		contents[0].classList.add('active')
		if (wrapper) wrapper.style.height = contents[0].offsetHeight + 'px'
		emitActiveVacancyChange(contents[0])
	}

	buttons.forEach(button => {
		button.addEventListener('click', () => {
			const selectedJob = normalizeString(button.getAttribute('data-job'))

			buttons.forEach(btn => btn.classList.remove('active'))
			button.classList.add('active')

			const current = document.querySelector('.vacancy-card.active')
			let next = null
			contents.forEach(content => {
				const contentJob = normalizeString(content.getAttribute('data-job'))
				if (contentJob === selectedJob) next = content
			})

			if (!next || next === current) return

			// Transition out current
			if (current) {
				current.classList.remove('active')
				current.classList.add('leaving')
			}

			// Prepare next and transition in
			next.classList.add('entering')
			if (wrapper) wrapper.style.height = next.offsetHeight + 'px'
			requestAnimationFrame(() => {
				next.classList.add('active')
				next.classList.remove('entering')
				emitActiveVacancyChange(next)
				if (current) {
					setTimeout(() => current.classList.remove('leaving'), 350)
				}
			})
		})
	})

	if (!select) return

	select.addEventListener('change', () => {
		const selectedJob = normalizeString(
			select.options[select.selectedIndex].getAttribute('data-job')
		)

		// Sync tab buttons active state
		buttons.forEach(btn => {
			const buttonJob = normalizeString(btn.getAttribute('data-job'))
			if (buttonJob === selectedJob) btn.classList.add('active')
			else btn.classList.remove('active')
		})

		// Find current and next
		const current = document.querySelector('.vacancy-card.active')
		let next = null
		contents.forEach(content => {
			const contentJob = normalizeString(content.getAttribute('data-job'))
			if (contentJob === selectedJob) next = content
		})
		if (!next || next === current) return

		// Animate like desktop
		if (current) {
			current.classList.remove('active')
			current.classList.add('leaving')
		}
		next.classList.add('entering')
		if (wrapper) wrapper.style.height = next.offsetHeight + 'px'
		requestAnimationFrame(() => {
			next.classList.add('active')
			next.classList.remove('entering')
			emitActiveVacancyChange(next)
			if (current) setTimeout(() => current.classList.remove('leaving'), 350)
		})
	})
}
