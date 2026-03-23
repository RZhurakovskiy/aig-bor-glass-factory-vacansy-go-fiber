package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
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
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var appVersion = "dev"

func main() {
	db, err := gorm.Open(sqlite.Open("glass-factory.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("ошибка открытия базы данных: %v", err)
	}

	if err := db.AutoMigrate(&models.Vacancy{}, &models.Contact{}, &models.AdminUser{}, &models.VacancyView{}, &models.SiteVisit{}); err != nil {
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
	sessionSecret := mustLoadSessionSecret()

	return handlers.New(db, []byte(sessionSecret), 24*time.Hour, appVersion)
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

	var bootstrapUser models.AdminUser
	err := db.Where("login = ?", models.BootstrapAdminLogin).First(&bootstrapUser).Error
	if err != nil {
		if err != gorm.ErrRecordNotFound {
			return err
		}

		bootstrapPassword := strings.TrimSpace(os.Getenv("BOOTSTRAP_ADMIN_PASSWORD"))
		if bootstrapPassword == "" {
			return fmt.Errorf("не задана переменная окружения BOOTSTRAP_ADMIN_PASSWORD для создания главного администратора")
		}

		hash, hashErr := bcrypt.GenerateFromPassword([]byte(bootstrapPassword), bcrypt.DefaultCost)
		if hashErr != nil {
			return hashErr
		}

		bootstrapUser = models.AdminUser{
			Login:        models.BootstrapAdminLogin,
			PasswordHash: string(hash),
			Role:         models.AdminUserRoleHR,
			Active:       true,
			IsRoot:       true,
		}
		if err := db.Create(&bootstrapUser).Error; err != nil {
			return err
		}
	}

	if err := db.Model(&models.AdminUser{}).
		Where("login = ?", models.BootstrapAdminLogin).
		Updates(map[string]any{
			"is_root": true,
			"role":    models.AdminUserRoleHR,
			"active":  true,
		}).Error; err != nil {
		return err
	}

	if err := db.Model(&models.AdminUser{}).
		Where("login <> ?", models.BootstrapAdminLogin).
		Update("is_root", false).Error; err != nil {
		return err
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

func mustLoadSessionSecret() string {
	generated, err := generateSessionSecret()
	if err != nil {
		log.Fatalf("ошибка генерации секрета сессии: %v", err)
	}
	log.Println("секрет сессии сгенерирован автоматически для текущего запуска сервера")
	return generated
}
