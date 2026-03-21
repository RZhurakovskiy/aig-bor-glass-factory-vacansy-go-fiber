export function initNavigationAnimation() {
	const navBar = document.querySelector('.nav-bar')

	if (!navBar) return

	if (document.readyState === 'complete') {
		navBar.classList.remove('hidden')
	}
}
