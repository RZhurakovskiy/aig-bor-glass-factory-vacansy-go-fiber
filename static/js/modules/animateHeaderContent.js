export function initHeaderAnimation() {
	const elements = document.querySelectorAll('.fade-in')

	function animateElements() {
		elements.forEach((element, index) => {
			setTimeout(() => {
				element.classList.add('active')
			}, index * 300)
		})
	}

	window.addEventListener('load', () => {
		animateElements()
	})
}

// Вызов функции при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
	initHeaderAnimation()
})
