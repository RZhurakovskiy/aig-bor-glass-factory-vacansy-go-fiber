package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"glass-factory/internal/models"

	"gorm.io/gorm"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

const (
	AdminCookie = "glass_factory_admin"
)

type Handler struct {
	db            *gorm.DB
	sessionSecret []byte
	sessionTTL    time.Duration
	appVersion    string
}

func New(db *gorm.DB, sessionSecret []byte, sessionTTL time.Duration, appVersion string) *Handler {
	return &Handler{
		db:            db,
		sessionSecret: sessionSecret,
		sessionTTL:    sessionTTL,
		appVersion:    appVersion,
	}
}

func (h *Handler) RequireAdmin(c *fiber.Ctx) error {
	token := c.Cookies(AdminCookie)
	if token != "" {
		user, err := h.getAdminUserFromToken(token)
		if err == nil {
			c.Locals("adminUser", user)
			return c.Next()
		}
	}

	if strings.HasPrefix(c.Path(), "/api/") {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "требуется авторизация администратора",
		})
	}

	return c.Redirect("/admin/login", fiber.StatusSeeOther)
}

func (h *Handler) Login(c *fiber.Ctx) error {
	expectsJSON := strings.HasPrefix(c.Get("Content-Type"), fiber.MIMEApplicationJSON) ||
		strings.Contains(c.Get("Accept"), fiber.MIMEApplicationJSON)

	login := strings.TrimSpace(c.FormValue("login"))
	password := strings.TrimSpace(c.FormValue("password"))
	if login == "" || password == "" {
		var payload map[string]string
		if err := c.BodyParser(&payload); err == nil {
			if login == "" {
				login = strings.TrimSpace(payload["login"])
			}
			password = strings.TrimSpace(payload["password"])
		}
	}

	if login == "" || password == "" {
		if expectsJSON {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "логин и пароль обязательны"})
		}
		return c.Status(fiber.StatusBadRequest).SendString("Логин и пароль обязательны")
	}

	var user models.AdminUser
	if err := h.db.Where("login = ?", strings.ToLower(login)).First(&user).Error; err != nil {
		if expectsJSON {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "неверный логин или пароль"})
		}
		return c.Status(fiber.StatusUnauthorized).SendString("Неверный логин или пароль")
	}

	if !user.Active || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		if expectsJSON {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "неверный логин или пароль"})
		}
		return c.Status(fiber.StatusUnauthorized).SendString("Неверный логин или пароль")
	}

	token, err := h.createSessionToken(user.ID)
	if err != nil {
		if expectsJSON {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось создать сессию"})
		}
		return c.Status(fiber.StatusInternalServerError).SendString("Не удалось создать сессию")
	}

	c.Cookie(&fiber.Cookie{
		Name:     AdminCookie,
		Value:    token,
		Path:     "/",
		HTTPOnly: true,
		Secure:   c.Protocol() == "https",
		Expires:  time.Now().Add(h.sessionTTL),
		SameSite: "Lax",
	})

	if expectsJSON {
		return c.JSON(fiber.Map{"ok": true})
	}

	return c.Redirect("/admin", fiber.StatusSeeOther)
}

func (h *Handler) Logout(c *fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{
		Name:     AdminCookie,
		Value:    "",
		Path:     "/",
		HTTPOnly: true,
		Secure:   c.Protocol() == "https",
		Expires:  time.Unix(0, 0),
		SameSite: "Lax",
	})
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) createSessionToken(userID uint) (string, error) {
	expiresAt := time.Now().Add(h.sessionTTL).Unix()
	payload := fmt.Sprintf("%d:%d", userID, expiresAt)
	signature, err := h.signSessionPayload(payload)
	if err != nil {
		return "", err
	}
	return payload + "." + signature, nil
}

func (h *Handler) getAdminUserFromToken(token string) (models.AdminUser, error) {
	var user models.AdminUser

	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return user, errors.New("invalid token format")
	}

	payloadParts := strings.Split(parts[0], ":")
	if len(payloadParts) != 2 {
		return user, errors.New("invalid token payload")
	}

	userID, err := strconv.ParseUint(payloadParts[0], 10, 64)
	if err != nil {
		return user, errors.New("invalid token user id")
	}

	expiresAt, err := strconv.ParseInt(payloadParts[1], 10, 64)
	if err != nil {
		return user, errors.New("invalid token expiration")
	}
	if time.Now().Unix() > expiresAt {
		return user, errors.New("token expired")
	}

	expectedSignature, err := h.signSessionPayload(parts[0])
	if err != nil {
		return user, err
	}
	if !hmac.Equal([]byte(parts[1]), []byte(expectedSignature)) {
		return user, errors.New("invalid token signature")
	}

	if err := h.db.First(&user, uint(userID)).Error; err != nil {
		return user, err
	}
	if !user.Active {
		return user, errors.New("user inactive")
	}

	return user, nil
}

func (h *Handler) signSessionPayload(payload string) (string, error) {
	if len(h.sessionSecret) == 0 {
		return "", fmt.Errorf("session secret is empty")
	}

	mac := hmac.New(sha256.New, h.sessionSecret)
	if _, err := mac.Write([]byte(payload)); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), nil
}
