export function animationSvgToScroll(
	targetSelector = '.decor-element',
	animationClass = 'animate',
	threshold = 0.1
) {
	const handleIntersection = entries => {
		entries.forEach(entry => {
			const element = entry.target
			if (entry.isIntersecting) {
				element.classList.remove(animationClass)
				void element.offsetWidth
				element.classList.add(animationClass)
			} else {
				element.classList.remove(animationClass)
			}
		})
	}

	const observer = new IntersectionObserver(handleIntersection, { threshold })

	const elements = document.querySelectorAll(targetSelector)
	if (elements.length) {
		elements.forEach(element => observer.observe(element))
	}
}
