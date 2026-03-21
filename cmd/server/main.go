package main

import (
	"crypto/rand"
	"encoding/base64"
	"io/fs"
	"log"
	"net/http"
	"os"
	"time"

	assets "glass-factory"
	"glass-factory/internal/handlers"
	"glass-factory/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	db, err := gorm.Open(sqlite.Open("glass-factory.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("ошибка открытия базы данных: %v", err)
	}

	if err := db.AutoMigrate(&models.Vacancy{}, &models.Contact{}); err != nil {
		log.Fatalf("ошибка миграции базы данных: %v", err)
	}

	if err := seedDatabase(db); err != nil {
		log.Fatalf("ошибка начального заполнения базы: %v", err)
	}

	staticFS, err := loadStaticFS()
	if err != nil {
		log.Fatalf("ошибка подготовки статики: %v", err)
	}

	app := fiber.New()
	registerRoutes(app, db, http.FS(staticFS), staticFS)

	log.Println("сервер запущен на http://localhost:8080")
	if err := app.Listen(":8080"); err != nil {
		log.Fatalf("ошибка запуска сервера: %v", err)
	}
}

func newHandler(db *gorm.DB) *handlers.Handler {
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "Admin12345"
	}

	sessionSecret := os.Getenv("ADMIN_SESSION_SECRET")
	if sessionSecret == "" {
		var err error
		sessionSecret, err = generateSessionSecret()
		if err != nil {
			log.Fatalf("ошибка генерации секрета сессии: %v", err)
		}
		log.Println("ADMIN_SESSION_SECRET не задан, используется временный секрет до перезапуска сервера")
	}

	return handlers.New(db, adminPassword, []byte(sessionSecret), 24*time.Hour)
}

func seedDatabase(db *gorm.DB) error {
	var vacancyCount int64
	if err := db.Model(&models.Vacancy{}).Count(&vacancyCount).Error; err != nil {
		return err
	}
	if vacancyCount == 0 {
		vacancies := models.DefaultVacancies()
		if err := db.Create(&vacancies).Error; err != nil {
			return err
		}
	}

	var contactCount int64
	if err := db.Model(&models.Contact{}).Count(&contactCount).Error; err != nil {
		return err
	}
	if contactCount == 0 {
		contact := models.DefaultContact()
		if err := db.Create(&contact).Error; err != nil {
			return err
		}
	}

	return nil
}

func loadStaticFS() (fs.FS, error) {
	if os.Getenv("APP_ENV") == "dev" {
		return os.DirFS("static"), nil
	}

	return fs.Sub(assets.Files, "static")
}

func generateSessionSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
