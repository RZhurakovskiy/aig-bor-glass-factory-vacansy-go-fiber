import { initHeaderAnimation } from './modules/animateHeaderContent.js'
import { initNavigationAnimation } from './modules/animationNavigatePanel.js'
import { animationSvgToScroll } from './modules/animationSvgToScroll.js'
import { initCounterObserver } from './modules/counterNumber.js'
import { mobileMenu } from './modules/mobileMenu.js'
import { createPreloader } from './modules/preloader.js'
import { selectFilter } from './modules/selectFilter.js'
import { tabsFilter } from './modules/tabsFilter.js'

document.addEventListener('DOMContentLoaded', async () => {
	const preloader = createPreloader()
	mobileMenu()
	animationSvgToScroll()
	initCounterObserver()
	initNavigationAnimation()
	initHeaderAnimation()
	initActiveNavHighlight()
	initScrollReveal()
	initScrollProgress()
	initCookieConsent()
	preloader.setProgress(25, 'Инициализируем интерфейс')

	await renderVacancies(() =>
		preloader.setProgress(65, 'Загружаем список вакансий')
	)
	await renderContacts(() =>
		preloader.setProgress(85, 'Загружаем контакты')
	)

	preloader.setProgress(95, 'Завершаем загрузку')
	await preloader.complete()

	tabsFilter()
	selectFilter()
})

async function renderVacancies(onLoaded) {
	const container = document.getElementById('vacancies-container')
	if (!container) {
		if (typeof onLoaded === 'function') onLoaded()
		return
	}

	try {
		const response = await fetch('/api/vacancies')
		if (!response.ok) throw new Error(`Failed to load vacancies: ${response.status}`)
		const vacancies = await response.json()

		if (!vacancies.length) {
			container.innerHTML =
				'<div class="vacancy-card__item"><article class="vacancy-card active"><div class="vacancy-card__description"><div class="vacancy-card__description-item"><h4>Сейчас вакансии обновляются</h4><p>Пожалуйста, попробуйте открыть страницу позже или свяжитесь с нами по контактам ниже.</p></div></div></article></div>'
			return
		}

		container.innerHTML = `
			<div class="vacancy-filter">
				${vacancies
					.map(
						vacancy => `
							<button class="tab-button" data-job="${escapeAttribute(vacancy.title)}">
								${escapeHtml(vacancy.title)}
							</button>
						`
					)
					.join('')}
			</div>
			<div class="vacancy-filter-mobile">
				<label for="vacancy-select">Выберите вакансию:</label>
				<select id="vacancy-select" class="vacancy-select">
					${vacancies
						.map(
							vacancy => `
								<option value="${escapeAttribute(vacancy.title)}" data-job="${escapeAttribute(vacancy.title)}">
									${escapeHtml(vacancy.title)}
								</option>
							`
						)
						.join('')}
				</select>
			</div>
			<div class="vacancy-card__item">
				${vacancies
					.map(
						(vacancy, index) => `
							<article class="vacancy-card" data-job="${escapeAttribute(vacancy.title)}">
								<div class="vacancy-card__header">
									<div class="vacancy-card__number-block">
										<span class="vacancy-card__number">${index + 1}.</span>
									</div>
									<div class="vacancy-card__title">
										<h4>${escapeHtml(vacancy.title)}</h4>
										${vacancy.scheduleLines
											.map(line => `<p>${escapeHtml(line)}</p>`)
											.join('')}
									</div>
								</div>
								<div class="vacancy-card__description">
									${renderVacancyColumn('Обязанности', vacancy.dutiesList)}
									${renderVacancyColumn('Требования', vacancy.requirementsList)}
									${renderVacancyColumn('Условия', vacancy.conditionsList)}
								</div>
							</article>
						`
					)
					.join('')}
			</div>
		`
		if (typeof onLoaded === 'function') onLoaded()
	} catch (error) {
		console.error(error)
		container.innerHTML =
			'<div class="vacancy-card__item"><article class="vacancy-card active"><div class="vacancy-card__description"><div class="vacancy-card__description-item"><h4>Не удалось загрузить вакансии</h4><p>Проверьте доступность сервера и обновите страницу.</p></div></div></article></div>'
		if (typeof onLoaded === 'function') onLoaded()
	}
}

function renderVacancyColumn(title, items) {
	return `
		<div class="vacancy-card__description-item">
			<h4>${title}</h4>
			<ul class="vacancy-card__description-list">
				${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
			</ul>
		</div>
	`
}

async function renderContacts(onLoaded) {
	const container = document.getElementById('contacts-container')
	if (!container) {
		if (typeof onLoaded === 'function') onLoaded()
		return
	}

	try {
		const response = await fetch('/api/contacts')
		if (!response.ok) throw new Error(`Failed to load contacts: ${response.status}`)
		const contacts = await response.json()
		const phones = Array.isArray(contacts.phonesList) ? contacts.phonesList : []
		const socials = [
			{
				url: contacts.vk,
				icon: './img/footer-icon/vk-icon.svg',
				label: 'Иконка vk.com',
			},
			{
				url: contacts.telegram,
				icon: './img/footer-icon/telegram-icon.svg',
				label: 'Иконка telegram',
			},
			{
				url: contacts.whatsapp,
				icon: './img/footer-icon/whatsapp-icon.svg',
				label: 'Иконка whatsapp',
			},
		].filter(item => item.url)

		container.innerHTML = `
			<div class="footer-contacts">
				${phones
					.map(
						phone => `
							<ul class="footer-contacts__list">
								<li><a href="tel:${phone.replace(/[^\d+]/g, '')}">${escapeHtml(phone)}</a></li>
							</ul>
						`
					)
					.join('')}
				${
					contacts.email
						? `<ul class="footer-contacts__list"><li><a href="mailto:${escapeAttribute(contacts.email)}">${escapeHtml(contacts.email)}</a></li></ul>`
						: ''
				}
			</div>
			<div class="footer-icons">
				${socials
					.map(
						item => `
							<a href="${escapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer">
								<img src="${item.icon}" alt="${item.label}" loading="lazy" />
							</a>
						`
					)
					.join('')}
			</div>
		`
		if (typeof onLoaded === 'function') onLoaded()
	} catch (error) {
		console.error(error)
		if (typeof onLoaded === 'function') onLoaded()
	}
}

function initActiveNavHighlight() {
	const sections = [
		{ id: '#about-company', link: "a[href='#about-company']" },
		{ id: '#social-package', link: "a[href='#social-package']" },
		{ id: '#vacancy-company', link: "a[href='#vacancy-company']" },
		{ id: '#contacts', link: "a[href='#contacts']" },
	]
	const nav = document.querySelector('.nav-bar')
	if (!nav) return

	const opts = { root: null, rootMargin: '0px 0px -50% 0px', threshold: 0.0 }
	const observer = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			const item = sections.find(section => section.id === `#${entry.target.id}`)
			if (!item) return
			document.querySelectorAll(item.link).forEach(link => {
				if (entry.isIntersecting) link.classList.add('is-active')
				else link.classList.remove('is-active')
			})
		})
	}, opts)

	sections.forEach(section => {
		const element = document.querySelector(section.id)
		if (element) observer.observe(element)
	})
}

function initScrollReveal() {
	const elements = document.querySelectorAll('.reveal-up, .reveal-zoom, .reveal-fade')
	if (!elements.length) return

	const observer = new IntersectionObserver(
		entries => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					entry.target.classList.add('is-visible')
					observer.unobserve(entry.target)
				}
			})
		},
		{ rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
	)

	elements.forEach(element => observer.observe(element))
}

function initScrollProgress() {
	const bar = document.querySelector('.scroll-progress__bar')
	if (!bar) return

	const update = () => {
		const scrollTop = window.pageYOffset || document.documentElement.scrollTop
		const docHeight =
			document.documentElement.scrollHeight -
			document.documentElement.clientHeight
		const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
		bar.style.width = progress + '%'
	}

	update()
	window.addEventListener('scroll', update, { passive: true })
	window.addEventListener('resize', update)
}

function initCookieConsent() {
	const consentBanner = document.getElementById('cookieConsent')
	const acceptButton = document.getElementById('acceptCookie')
	if (!consentBanner || !acceptButton) return

	if (!getCookie('cookieConsentAccepted')) {
		consentBanner.style.display = 'flex'
	}

	acceptButton.addEventListener('click', () => {
		setCookie('cookieConsentAccepted', 'true', 365)
		consentBanner.style.display = 'none'
	})
}

function setCookie(name, value, days) {
	let expires = ''
	if (days) {
		const date = new Date()
		date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
		expires = '; expires=' + date.toUTCString()
	}

	document.cookie =
		name + '=' + encodeURIComponent(value || '') + expires + '; path=/'
}

function getCookie(name) {
	const nameEQ = name + '='
	const parts = document.cookie.split(';')
	for (const part of parts) {
		const cookie = part.trim()
		if (cookie.indexOf(nameEQ) === 0) {
			return decodeURIComponent(cookie.substring(nameEQ.length, cookie.length))
		}
	}
	return null
}

function escapeHtml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

function escapeAttribute(value) {
	return escapeHtml(value).replaceAll('`', '&#96;')
}
