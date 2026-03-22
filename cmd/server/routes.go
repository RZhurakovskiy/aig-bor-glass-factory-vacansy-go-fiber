package main

import (
	"io/fs"
	"net/http"
	"path"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"gorm.io/gorm"
)

func registerRoutes(app *fiber.App, db *gorm.DB, staticHTTPFS http.FileSystem, staticFS fs.FS) {
	h := newHandler(db)

	app.Get("/api/vacancies", h.GetPublicVacancies)
	app.Post("/api/metrics/vacancy-view", h.TrackVacancyView)
	app.Get("/api/contacts", h.GetContacts)

	app.Get("/admin/login", serveLoginPage)
	app.Post("/admin/login", h.Login)

	app.Post("/admin/logout", h.RequireAdmin, h.Logout)
	app.Get("/admin", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin/", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin.html", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin/vacancies", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin/vacancies/", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin/contacts", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin/contacts/", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin/users", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin/users/", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin/metrics", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin/metrics/", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin/:section", h.RequireAdmin, serveAdminSection(staticFS))
	app.Get("/admin/:section/", h.RequireAdmin, serveAdminSection(staticFS))

	adminAPI := app.Group("/api/admin", h.RequireAdmin)
	adminAPI.Get("/vacancies", h.GetAdminVacancies)
	adminAPI.Get("/vacancies/trash", h.GetAdminTrashVacancies)
	adminAPI.Post("/vacancies", h.CreateVacancy)
	adminAPI.Put("/vacancies/order", h.ReorderVacancies)
	adminAPI.Put("/vacancies/:id", h.UpdateVacancy)
	adminAPI.Put("/vacancies/:id/restore", h.RestoreVacancy)
	adminAPI.Delete("/vacancies/trash", h.EmptyTrashVacancies)
	adminAPI.Delete("/vacancies/:id", h.DeleteVacancy)
	adminAPI.Delete("/vacancies/:id/permanent", h.PurgeVacancy)
	adminAPI.Get("/meta", h.GetAdminMeta)
	adminAPI.Get("/contacts", h.GetContacts)
	adminAPI.Put("/contacts", h.UpdateContacts)
	adminAPI.Get("/users", h.GetAdminUsers)
	adminAPI.Post("/users", h.CreateAdminUser)
	adminAPI.Put("/users/:id", h.UpdateAdminUser)
	adminAPI.Get("/metrics/vacancy-views", h.GetVacancyMetrics)

	app.Use("/", filesystem.New(filesystem.Config{
		Root:         staticHTTPFS,
		Index:        "index.html",
		NotFoundFile: "404.html",
	}))
}

func serveStaticPage(staticFS fs.FS, name string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		body, err := fs.ReadFile(staticFS, name)
		if err != nil {
			return fiber.ErrNotFound
		}

		c.Type(path.Ext(name)[1:])
		return c.Send(body)
	}
}

func serveAdminSection(staticFS fs.FS) fiber.Handler {
	return func(c *fiber.Ctx) error {
		switch c.Params("section") {
		case "vacancies", "contacts", "users", "metrics":
			return serveStaticPage(staticFS, "admin.html")(c)
		default:
			return fiber.ErrNotFound
		}
	}
}

func serveLoginPage(c *fiber.Ctx) error {
	c.Type("html")
	return c.SendString(`<!DOCTYPE html>
<html lang="ru">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Вход в панель администратора</title>
	<style>
		:root {
			color-scheme: light;
			--login-bg: radial-gradient(circle at top left, rgba(112,136,150,0.08), transparent 28%), linear-gradient(180deg, #f8fbff 0%, #eef3f9 100%);
			--login-text: #1f2937;
			--login-muted: #667085;
			--login-card-bg: rgba(255,255,255,0.92);
			--login-card-border: rgba(17,24,39,0.08);
			--login-input-bg: rgba(255,255,255,0.98);
			--login-input-border: rgba(17,24,39,0.12);
			--login-shadow: 0 24px 60px rgba(15,23,42,0.12);
		}
		* { box-sizing: border-box; }
		body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; min-height: 100vh; display: grid; place-items: center; background: var(--login-bg); color: var(--login-text); transition: background 0.22s ease, color 0.22s ease; }
		form { width: min(420px, calc(100% - 32px)); padding: 32px; border-radius: 16px; border: 1px solid var(--login-card-border); background: var(--login-card-bg); backdrop-filter: blur(16px); box-shadow: var(--login-shadow); }
		h1 { margin-top: 0; margin-bottom: 12px; font-size: 32px; }
		p { margin: 0; line-height: 1.5; color: var(--login-muted); }
		label { display: grid; gap: 8px; margin: 20px 0 18px; font-weight: 700; }
		.login-password-field { position: relative; display: grid; }
		input { padding: 14px 16px; border-radius: 10px; border: 1px solid var(--login-input-border); background: var(--login-input-bg); color: var(--login-text); font-size: 16px; }
		.login-password-field input { padding-right: 52px; }
		input:focus { outline: none; border-color: rgba(112,136,150,0.55); box-shadow: 0 0 0 3px rgba(112,136,150,0.16); }
		button { width: 100%; padding: 14px 16px; border: 0; border-radius: 10px; background: #708896; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; transition: opacity 0.18s ease, transform 0.18s ease; }
		button:hover { opacity: 0.92; }
		button:disabled { opacity: 0.7; cursor: wait; }
		.login-password-toggle { position: absolute; top: 50%; right: 8px; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--login-muted); transform: translateY(-50%); display: inline-flex; align-items: center; justify-content: center; }
		.login-password-toggle:hover { opacity: 1; background: rgba(112,136,150,0.1); color: var(--login-text); }
		.login-password-toggle:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(112,136,150,0.16); }
		.login-password-toggle svg { width: 18px; height: 18px; display: block; }
		.login-password-toggle .login-password-toggle__icon-off { display: none; }
		.login-password-toggle.is-visible .login-password-toggle__icon-on { display: none; }
		.login-password-toggle.is-visible .login-password-toggle__icon-off { display: block; }
		.login-status { min-height: 22px; margin-top: 8px; font-size: 14px; color: var(--login-muted); }
		.login-status.is-error { color: #d92d20; }
		.login-toast-stack { position: fixed; top: 20px; right: 20px; z-index: 20; display: grid; gap: 10px; width: min(360px, calc(100vw - 32px)); }
		.login-toast { position: relative; overflow: hidden; padding: 16px 18px; border: 1px solid transparent; border-radius: 12px; box-shadow: 0 18px 42px rgba(0,0,0,0.22); font-size: 15px; font-weight: 600; line-height: 1.4; animation: login-toast-in 0.22s ease forwards; }
		.login-toast::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: rgba(255,255,255,0.34); transform-origin: left center; animation: login-toast-progress var(--toast-duration, 3200ms) linear forwards; }
		.login-toast_error { color: #fff; border-color: #b42318; background: #d92d20; }
		.login-toast.is-leaving { animation: login-toast-out 0.24s ease forwards; }
		@keyframes login-toast-in { from { opacity: 0; transform: translate3d(18px, -12px, 0) scale(0.98); } to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
		@keyframes login-toast-out { from { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } to { opacity: 0; transform: translate3d(20px, -8px, 0) scale(0.98); } }
		@keyframes login-toast-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
	</style>
</head>
<body>
	<div class="login-toast-stack" id="loginToastStack" aria-live="polite" aria-atomic="true"></div>
	<form id="loginForm" method="post" action="/admin/login" novalidate>
		<h1>Панель администратора</h1>
		<p>Для входа используйте логин и пароль администратора.</p>
		<label>
			<span>Логин</span>
			<input type="text" name="login" autocomplete="username" required />
		</label>
		<label>
			<span>Пароль</span>
			<div class="login-password-field">
				<input id="loginPasswordInput" type="password" name="password" autocomplete="current-password" required />
				<button
					class="login-password-toggle"
					id="loginPasswordToggle"
					type="button"
					aria-label="Показать пароль"
					aria-pressed="false"
				>
					<svg class="login-password-toggle__icon-on" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<path d="M1.75 10C3.32 6.83 6.34 4.75 10 4.75C13.66 4.75 16.68 6.83 18.25 10C16.68 13.17 13.66 15.25 10 15.25C6.34 15.25 3.32 13.17 1.75 10Z" stroke="currentColor" stroke-width="1.5"/>
						<circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/>
					</svg>
					<svg class="login-password-toggle__icon-off" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<path d="M2.5 2.5L17.5 17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						<path d="M8.94 5.02C9.29 4.84 9.64 4.75 10 4.75C13.66 4.75 16.68 6.83 18.25 10C17.62 11.28 16.72 12.38 15.62 13.2M11.77 11.77C11.32 12.22 10.68 12.5 10 12.5C8.62 12.5 7.5 11.38 7.5 10C7.5 9.32 7.78 8.68 8.23 8.23M5.18 5.18C3.75 6.09 2.57 7.42 1.75 10C3.32 13.17 6.34 15.25 10 15.25C10.95 15.25 11.84 15.11 12.67 14.84" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
			</div>
		</label>
		<div class="login-status" id="loginStatus"></div>
		<button type="submit" id="loginSubmitButton">Войти</button>
	</form>
	<script>
		(() => {
			const form = document.getElementById('loginForm')
			const status = document.getElementById('loginStatus')
			const submitButton = document.getElementById('loginSubmitButton')
			const toastStack = document.getElementById('loginToastStack')
			const passwordInput = document.getElementById('loginPasswordInput')
			const passwordToggle = document.getElementById('loginPasswordToggle')

			function setStatus(message, isError) {
				if (!status) return
				status.textContent = message || ''
				status.classList.toggle('is-error', Boolean(isError))
			}

			function showToast(message, duration = 3200) {
				if (!toastStack || !message) return
				const toast = document.createElement('div')
				toast.className = 'login-toast login-toast_error'
				toast.textContent = message
				toast.style.setProperty('--toast-duration', duration + 'ms')
				toastStack.appendChild(toast)
				window.setTimeout(() => {
					toast.classList.add('is-leaving')
					window.setTimeout(() => toast.remove(), 240)
				}, duration)
			}

			passwordToggle?.addEventListener('click', () => {
				if (!passwordInput) return

				const isVisible = passwordInput.type === 'text'
				passwordInput.type = isVisible ? 'password' : 'text'
				passwordToggle.classList.toggle('is-visible', !isVisible)
				passwordToggle.setAttribute('aria-pressed', isVisible ? 'false' : 'true')
				passwordToggle.setAttribute(
					'aria-label',
					isVisible ? 'Показать пароль' : 'Скрыть пароль'
				)
			})

			form?.addEventListener('submit', async (event) => {
				event.preventDefault()
				setStatus('')

				const formData = new FormData(form)
				const payload = {
					login: String(formData.get('login') || '').trim(),
					password: String(formData.get('password') || '').trim(),
				}

				if (!payload.login || !payload.password) {
					const message = 'Введите логин и пароль.'
					setStatus(message, true)
					showToast(message)
					return
				}

				submitButton.disabled = true
				setStatus('Проверяю данные...')

				try {
					const response = await fetch('/admin/login', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Accept': 'application/json'
						},
						credentials: 'same-origin',
						body: JSON.stringify(payload)
					})

					let result = {}
					try {
						result = await response.json()
					} catch (_) {}

					if (!response.ok) {
						const message = result.error || 'Не удалось выполнить вход.'
						setStatus(message, true)
						showToast(message)
						return
					}

					window.location.href = '/admin'
				} catch (error) {
					const message = 'Не удалось выполнить вход. Проверьте соединение и попробуйте снова.'
					setStatus(message, true)
					showToast(message)
				} finally {
					submitButton.disabled = false
					if (!status.classList.contains('is-error')) {
						setStatus('')
					}
				}
			})
		})()
	</script>
</body>
</html>`)
}
