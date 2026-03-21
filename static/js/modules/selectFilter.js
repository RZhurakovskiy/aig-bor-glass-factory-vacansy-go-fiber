export function selectFilter() {
	const selectElement = document.getElementById('vacancy-select')
	const contents = document.querySelectorAll('.vacancy-card')

	if (!selectElement || !contents.length) return

	const initialJob = selectElement.value
	contents.forEach(content => {
		if (content.getAttribute('data-job') === initialJob) {
			content.classList.add('active')
		} else {
			content.classList.remove('active')
		}
	})

	selectElement.addEventListener('change', () => {
		const selectedJob = selectElement.value

		contents.forEach(content => {
			if (content.getAttribute('data-job') === selectedJob) {
				content.classList.add('active')
			} else {
				content.classList.remove('active')
			}
		})
	})
}
