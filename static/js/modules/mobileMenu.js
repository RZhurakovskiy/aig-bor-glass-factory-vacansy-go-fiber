export function mobileMenu() {
	const menuBtn = document.querySelector('.menu-btn')
	const menuItem = document.querySelector('.main-nav-list')
	const menuLinks = document.querySelectorAll('.main-nav-list a')
	const body = document.querySelector('body')
	const overlay = document.querySelector('.menu-overlay')
	const closeBtn = document.querySelector('.menu-close')

	if (!menuBtn || !menuItem) return

	menuBtn.setAttribute('role', 'button')
	menuBtn.setAttribute('tabindex', '0')
	menuBtn.setAttribute('aria-controls', 'mobile-menu')
	menuItem.setAttribute('id', 'mobile-menu')
	menuBtn.setAttribute('aria-expanded', 'false')
	menuBtn.setAttribute('aria-label', 'Открыть меню')

	const openMenu = () => {
		menuBtn.classList.add('active')
		menuItem.classList.add('active')
		overlay && overlay.classList.add('active')
		body.classList.add('menu-open')
		menuBtn.setAttribute('aria-expanded', 'true')
		menuBtn.setAttribute('aria-label', 'Закрыть меню')
	}

	const closeMenu = () => {
		menuBtn.classList.remove('active')
		menuItem.classList.remove('active')
		overlay && overlay.classList.remove('active')
		body.classList.remove('menu-open')
		menuBtn.setAttribute('aria-expanded', 'false')
		menuBtn.setAttribute('aria-label', 'Открыть меню')
	}

	menuBtn.addEventListener('click', () => {
		if (menuItem.classList.contains('active')) {
			closeMenu()
		} else {
			openMenu()
		}
	})

	menuBtn.addEventListener('keydown', e => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			if (menuItem.classList.contains('active')) closeMenu()
			else openMenu()
		}
	})

	menuLinks.forEach(link => {
		link.addEventListener('click', () => {
			closeMenu()
		})
	})

	body.addEventListener('click', e => {
		if (!e.target.closest('.main-nav-list') && !e.target.closest('.menu-btn')) {
			closeMenu()
		}
	})

	overlay && overlay.addEventListener('click', closeMenu)
	closeBtn && closeBtn.addEventListener('click', closeMenu)
	closeBtn && closeBtn.addEventListener('keydown', e => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			closeMenu()
		}
	})

	document.addEventListener('keydown', e => {
		if (e.key === 'Escape' && menuItem.classList.contains('active')) {
			closeMenu()
		}
	})
}
