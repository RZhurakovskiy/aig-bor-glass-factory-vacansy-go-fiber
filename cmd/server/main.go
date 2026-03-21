package main

import (
	"crypto/rand"
	"encoding/base64"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	assets "glass-factory"
	"glass-factory/internal/handlers"
	"glass-factory/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var appVersion = "dev"

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
	adminPassword := mustLoadConfig("ADMIN_PASSWORD", "Admin12345")
	sessionSecret := mustLoadSessionSecret()

	return handlers.New(db, adminPassword, []byte(sessionSecret), 24*time.Hour, appVersion)
}

func seedDatabase(db *gorm.DB) error {
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

func mustLoadConfig(key string, devFallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value != "" {
		return value
	}

	if os.Getenv("APP_ENV") == "dev" {
		return devFallback
	}

	log.Fatalf("не задана обязательная переменная окружения %s", key)
	return ""
}

func mustLoadSessionSecret() string {
	secret := strings.TrimSpace(os.Getenv("ADMIN_SESSION_SECRET"))
	if secret != "" {
		return secret
	}

	if os.Getenv("APP_ENV") == "dev" {
		generated, err := generateSessionSecret()
		if err != nil {
			log.Fatalf("ошибка генерации секрета сессии: %v", err)
		}
		log.Println("ADMIN_SESSION_SECRET не задан, используется временный секрет только для dev-режима")
		return generated
	}

	log.Fatalf("не задана обязательная переменная окружения %s", "ADMIN_SESSION_SECRET")
	return ""
}
