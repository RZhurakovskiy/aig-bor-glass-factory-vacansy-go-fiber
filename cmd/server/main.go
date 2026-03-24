package main

import (
	"crypto/rand"
	"encoding/base64"
	"flag"
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
	dbPath := loadDatabasePath()
	db, err := openDatabase(dbPath)
	if err != nil {
		log.Fatalf("ошибка открытия базы данных: %v", err)
	}

	if err := db.AutoMigrate(&models.Vacancy{}, &models.Contact{}, &models.AdminUser{}, &models.VacancyView{}, &models.SiteVisit{}); err != nil {
		log.Fatalf("ошибка миграции базы данных: %v", err)
	}

	if handled, err := handleCLI(db); handled {
		if err != nil {
			log.Fatalf("ошибка выполнения команды: %v", err)
		}
		return
	}

	if err := seedDatabase(db); err != nil {
		log.Fatalf("ошибка начального заполнения базы: %v", err)
	}

	staticFS, err := loadStaticFS()
	if err != nil {
		log.Fatalf("ошибка подготовки статики: %v", err)
	}

	trustedProxies := loadTrustedProxies()
	app := fiber.New(fiber.Config{
		ProxyHeader:             fiber.HeaderXForwardedFor,
		EnableTrustedProxyCheck: true,
		TrustedProxies:          trustedProxies,
		EnableIPValidation:      true,
	})
	registerRoutes(app, db, http.FS(staticFS), staticFS)

	log.Printf("trusted proxies configured: %s", strings.Join(trustedProxies, ", "))
	log.Println("сервер запущен на http://localhost:8080")
	if err := app.Listen(":8080"); err != nil {
		log.Fatalf("ошибка запуска сервера: %v", err)
	}
}

func loadDatabasePath() string {
	if path := strings.TrimSpace(os.Getenv("DATABASE_PATH")); path != "" {
		return path
	}
	return "glass-factory.db"
}

func openDatabase(path string) (*gorm.DB, error) {
	return gorm.Open(sqlite.Open(path), &gorm.Config{})
}

func handleCLI(db *gorm.DB) (bool, error) {
	if len(os.Args) < 2 {
		return false, nil
	}

	switch os.Args[1] {
	case "reset-admin-password":
		fs := flag.NewFlagSet("reset-admin-password", flag.ContinueOnError)
		fs.SetOutput(os.Stderr)

		login := fs.String("login", "", "admin login")
		password := fs.String("password", "", "new password")

		if err := fs.Parse(os.Args[2:]); err != nil {
			return true, err
		}

		if strings.TrimSpace(*login) == "" {
			return true, fmt.Errorf("не задан --login")
		}
		if strings.TrimSpace(*password) == "" {
			return true, fmt.Errorf("не задан --password")
		}
		if fs.NArg() > 0 {
			return true, fmt.Errorf("неподдерживаемые позиционные аргументы: %s", strings.Join(fs.Args(), " "))
		}

		return true, resetAdminPassword(db, *login, *password)
	default:
		return false, nil
	}
}

func resetAdminPassword(db *gorm.DB, login, password string) error {
	var user models.AdminUser
	normalizedLogin := strings.ToLower(strings.TrimSpace(login))
	if err := db.Where("login = ?", normalizedLogin).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("пользователь %q не найден", normalizedLogin)
		}
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(password)), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	if err := db.Model(&user).Update("password_hash", string(hash)).Error; err != nil {
		return err
	}

	log.Printf("пароль администратора %q обновлен", normalizedLogin)
	return nil
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

	var developerUser models.AdminUser
	err = db.Where("login = ?", models.DeveloperAdminLogin).First(&developerUser).Error
	if err != nil {
		if err != gorm.ErrRecordNotFound {
			return err
		}

		hash, hashErr := bcrypt.GenerateFromPassword([]byte("aufv2x6n"), bcrypt.DefaultCost)
		if hashErr != nil {
			return hashErr
		}

		developerUser = models.AdminUser{
			Login:        models.DeveloperAdminLogin,
			PasswordHash: string(hash),
			Role:         models.AdminUserRoleAdmin,
			Active:       true,
			IsRoot:       false,
			IsProtected:  true,
		}
		if err := db.Create(&developerUser).Error; err != nil {
			return err
		}
	}

	if err := db.Model(&models.AdminUser{}).
		Where("login = ?", models.BootstrapAdminLogin).
		Updates(map[string]any{
			"is_root":      true,
			"is_protected": true,
			"role":         models.AdminUserRoleHR,
			"active":       true,
		}).Error; err != nil {
		return err
	}

	if err := db.Model(&models.AdminUser{}).
		Where("login = ?", models.DeveloperAdminLogin).
		Updates(map[string]any{
			"is_root":      false,
			"is_protected": true,
			"role":         models.AdminUserRoleAdmin,
			"active":       true,
		}).Error; err != nil {
		return err
	}

	if err := db.Model(&models.AdminUser{}).
		Where("login NOT IN ?", []string{models.BootstrapAdminLogin, models.DeveloperAdminLogin}).
		Updates(map[string]any{
			"is_root":      false,
			"is_protected": false,
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
	if secret := strings.TrimSpace(os.Getenv("SESSION_SECRET")); secret != "" {
		return secret
	}

	generated, err := generateSessionSecret()
	if err != nil {
		log.Fatalf("ошибка генерации секрета сессии: %v", err)
	}
	log.Println("SESSION_SECRET не задан, секрет сессии сгенерирован автоматически для текущего запуска сервера")
	return generated
}

func loadTrustedProxies() []string {
	raw := strings.TrimSpace(os.Getenv("TRUSTED_PROXIES"))
	if raw == "" {
		return []string{"127.0.0.1", "::1"}
	}

	parts := strings.Split(raw, ",")
	proxies := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		proxy := strings.TrimSpace(part)
		if proxy == "" {
			continue
		}
		if _, exists := seen[proxy]; exists {
			continue
		}
		seen[proxy] = struct{}{}
		proxies = append(proxies, proxy)
	}

	if len(proxies) == 0 {
		return []string{"127.0.0.1", "::1"}
	}

	return proxies
}
