export function createPreloader() {
	const preloader = document.getElementById('preloader')
	const percent = document.getElementById('preloaderPercent')
	const status = document.getElementById('preloaderStatus')
	const progressBar = document.getElementById('preloaderBar')
	const navBar = document.querySelector('.nav-bar')
	const body = document.body

	if (!preloader) {
		return {
			setProgress() {},
			complete: async () => {},
		}
	}

	body?.classList.add('is-preloading')

	let currentProgress = 0

	const setProgress = (value, text) => {
		currentProgress = Math.max(currentProgress, Math.min(100, Math.round(value)))
		if (percent) {
			percent.textContent = `${currentProgress}%`
		}
		if (progressBar) {
			progressBar.style.width = `${currentProgress}%`
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
		body?.classList.remove('is-preloading')
		body?.classList.add('is-page-revealing')
		preloader.classList.add('is-closing')
		window.setTimeout(() => {
			preloader.style.display = 'none'
			body?.classList.remove('is-page-revealing')
			body?.classList.add('is-page-ready')
		}, 920)
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
