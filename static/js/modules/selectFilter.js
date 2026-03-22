export function selectFilter() {
	const selectElement = document.getElementById('vacancy-select')
	const contents = document.querySelectorAll('.vacancy-card')

	if (!selectElement || !contents.length) return

	const initialVacancyId = selectElement.value
	contents.forEach(content => {
		if (content.getAttribute('data-vacancy-id') === initialVacancyId) {
			content.classList.add('active')
		} else {
			content.classList.remove('active')
		}
	})

	selectElement.addEventListener('change', () => {
		const selectedVacancyId = selectElement.value

		contents.forEach(content => {
			if (content.getAttribute('data-vacancy-id') === selectedVacancyId) {
				content.classList.add('active')
			} else {
				content.classList.remove('active')
			}
		})
	})
}
