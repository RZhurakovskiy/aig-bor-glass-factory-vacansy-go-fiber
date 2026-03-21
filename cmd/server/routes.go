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
	app.Get("/api/contacts", h.GetContacts)

	app.Get("/admin/login", serveLoginPage)
	app.Post("/admin/login", h.Login)

	app.Post("/admin/logout", h.RequireAdmin, h.Logout)
	app.Get("/admin", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin/", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))
	app.Get("/admin.html", h.RequireAdmin, serveStaticPage(staticFS, "admin.html"))

	adminAPI := app.Group("/api/admin", h.RequireAdmin)
	adminAPI.Get("/contacts", h.GetContacts)
	adminAPI.Put("/contacts", h.UpdateContacts)

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

func serveLoginPage(c *fiber.Ctx) error {
	c.Type("html")
	return c.SendString(`<!DOCTYPE html>
<html lang="ru">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Вход в панель администратора</title>
	<style>
		body { margin: 0; font-family: sans-serif; min-height: 100vh; display: grid; place-items: center; background: linear-gradient(135deg, #111, #303030); color: #fff; }
		form { width: min(420px, calc(100% - 32px)); padding: 32px; border-radius: 24px; background: rgba(255,255,255,0.08); backdrop-filter: blur(16px); }
		h1 { margin-top: 0; font-size: 32px; }
		p { line-height: 1.5; color: rgba(255,255,255,0.76); }
		label { display: grid; gap: 8px; margin: 20px 0 18px; font-weight: 700; }
		input { padding: 14px 16px; border-radius: 14px; border: 0; font-size: 16px; }
		button { width: 100%; padding: 14px 16px; border: 0; border-radius: 999px; background: #ec0000; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }
	</style>
</head>
<body>
	<form method="post" action="/admin/login">
		<h1>Панель администратора</h1>
		<p>Для входа используйте пароль администратора.</p>
		<label>
			<span>Пароль</span>
			<input type="password" name="password" autocomplete="current-password" required />
		</label>
		<button type="submit">Войти</button>
	</form>
</body>
</html>`)
}
