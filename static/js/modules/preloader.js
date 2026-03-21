export function createPreloader() {
	const preloader = document.getElementById('preloader')
	const percent = document.getElementById('preloaderPercent')
	const status = document.getElementById('preloaderStatus')
	const navBar = document.querySelector('.nav-bar')

	if (!preloader) {
		return {
			setProgress() {},
			complete: async () => {},
		}
	}

	let currentProgress = 0

	const setProgress = (value, text) => {
		currentProgress = Math.max(currentProgress, Math.min(100, Math.round(value)))
		if (percent) {
			percent.textContent = `${currentProgress}%`
		}
		if (status && text) {
			status.textContent = text
		}
	}

	const complete = async () => {
		await Promise.all([waitForPageLoad(), waitForFonts()])
		setProgress(100, 'Страница готова')
		if (navBar) {
			navBar.classList.remove('hidden')
		}
		preloader.classList.add('hidden')
		window.setTimeout(() => {
			preloader.style.display = 'none'
		}, 500)
	}

	setProgress(5, 'Подготавливаем страницу')

	return { setProgress, complete }
}

function waitForPageLoad() {
	if (document.readyState === 'complete') {
		return Promise.resolve()
	}

	return new Promise(resolve => {
		window.addEventListener('load', () => resolve(), { once: true })
	})
}

function waitForFonts() {
	if (!document.fonts || typeof document.fonts.ready?.then !== 'function') {
		return Promise.resolve()
	}

	return document.fonts.ready.catch(() => undefined)
}
