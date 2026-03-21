document.addEventListener('DOMContentLoaded', function () {
	initCounterObserver()
})

export function initCounterObserver() {
	const counters = document.querySelectorAll('.number-count')

	const options = {
		root: null,
		threshold: 0.5,
	}

	const observer = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				updateCounter(entry.target)
				observer.unobserve(entry.target)
			}
		})
	}, options)

	counters.forEach(counter => {
		observer.observe(counter)
	})
}

function updateCounter(element) {
	const target = +element.getAttribute('data-target')
	const increment = target / 50
	let count = 0

	const interval = setInterval(() => {
		count += increment
		if (count >= target) {
			element.textContent = target
			clearInterval(interval)
		} else {
			element.textContent = Math.ceil(count)
		}
	}, 20)
}
