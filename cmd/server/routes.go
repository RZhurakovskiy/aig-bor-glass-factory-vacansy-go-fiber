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
	app.Post("/api/metrics/site-visit", h.TrackSiteVisit)
	app.Get("/api/contacts", h.GetContacts)
	app.Get("/api/meta", h.GetAdminMeta)
	app.Get("/system-info", serveStaticPage(staticFS, "system-info.html"))

	app.Get("/admin/login", serveStaticPage(staticFS, "admin-login.html"))
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
	adminAPI.Delete("/users/:id", h.DeleteAdminUser)
	adminAPI.Get("/metrics/vacancy-views", h.GetVacancyMetrics)

	// для 404
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
