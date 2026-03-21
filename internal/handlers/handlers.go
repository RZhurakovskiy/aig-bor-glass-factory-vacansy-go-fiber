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

	"gorm.io/gorm"

	"github.com/gofiber/fiber/v2"
)

const (
	AdminCookie = "glass_factory_admin"
)

type Handler struct {
	db            *gorm.DB
	adminPassword string
	sessionSecret []byte
	sessionTTL    time.Duration
	appVersion    string
}

func New(db *gorm.DB, adminPassword string, sessionSecret []byte, sessionTTL time.Duration, appVersion string) *Handler {
	return &Handler{
		db:            db,
		adminPassword: adminPassword,
		sessionSecret: sessionSecret,
		sessionTTL:    sessionTTL,
		appVersion:    appVersion,
	}
}

func (h *Handler) RequireAdmin(c *fiber.Ctx) error {
	token := c.Cookies(AdminCookie)
	if token != "" {
		if err := h.validateSessionToken(token); err == nil {
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

	password := strings.TrimSpace(c.FormValue("password"))
	if password == "" {
		var payload map[string]string
		if err := c.BodyParser(&payload); err == nil {
			password = strings.TrimSpace(payload["password"])
		}
	}

	if password != h.adminPassword {
		if expectsJSON {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "неверный пароль"})
		}
		return c.Status(fiber.StatusUnauthorized).SendString("Неверный пароль")
	}

	token, err := h.createSessionToken()
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

func (h *Handler) createSessionToken() (string, error) {
	expiresAt := time.Now().Add(h.sessionTTL).Unix()
	payload := strconv.FormatInt(expiresAt, 10)
	signature, err := h.signSessionPayload(payload)
	if err != nil {
		return "", err
	}
	return payload + "." + signature, nil
}

func (h *Handler) validateSessionToken(token string) error {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return errors.New("invalid token format")
	}

	expiresAt, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return errors.New("invalid token expiration")
	}
	if time.Now().Unix() > expiresAt {
		return errors.New("token expired")
	}

	expectedSignature, err := h.signSessionPayload(parts[0])
	if err != nil {
		return err
	}
	if !hmac.Equal([]byte(parts[1]), []byte(expectedSignature)) {
		return errors.New("invalid token signature")
	}

	return nil
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
