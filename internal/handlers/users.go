package handlers

import (
	"errors"
	"strings"

	"glass-factory/internal/models"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

type adminUserResponse struct {
	ID        uint   `json:"id"`
	Login     string `json:"login"`
	Role      string `json:"role"`
	Active    bool   `json:"active"`
	IsRoot    bool   `json:"isRoot"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type adminUserPayload struct {
	Login    string `json:"login"`
	Password string `json:"password"`
	Role     string `json:"role"`
	Active   bool   `json:"active"`
}

func (h *Handler) GetAdminUsers(c *fiber.Ctx) error {
	var users []models.AdminUser
	if err := h.db.Order("id asc").Find(&users).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить список пользователей"})
	}

	response := make([]adminUserResponse, 0, len(users))
	for _, user := range users {
		response = append(response, toAdminUserResponse(user))
	}

	return c.JSON(response)
}

func (h *Handler) CreateAdminUser(c *fiber.Ctx) error {
	var payload adminUserPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректные данные пользователя"})
	}

	login := normalizeLogin(payload.Login)
	if login == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "логин обязателен"})
	}

	password := strings.TrimSpace(payload.Password)
	if password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "пароль обязателен"})
	}

	role, err := normalizeAdminUserRole(payload.Role)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось создать пользователя"})
	}

	user := models.AdminUser{
		Login:        login,
		PasswordHash: string(hash),
		Role:         role,
		Active:       payload.Active,
		IsRoot:       false,
	}

	if user.Login == models.BootstrapAdminLogin {
		user.Role = models.AdminUserRoleAdmin
		user.Active = true
		user.IsRoot = true
	}

	if err := h.db.Create(&user).Error; err != nil {
		if isUniqueConstraintError(err) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "пользователь с таким логином уже существует"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось создать пользователя"})
	}

	return c.Status(fiber.StatusCreated).JSON(toAdminUserResponse(user))
}

func (h *Handler) UpdateAdminUser(c *fiber.Ctx) error {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный идентификатор пользователя"})
	}

	var user models.AdminUser
	if err := h.db.First(&user, id).Error; err != nil {
		return respondDBError(c, err)
	}

	var payload adminUserPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректные данные пользователя"})
	}

	login := normalizeLogin(payload.Login)
	if login == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "логин обязателен"})
	}

	role, err := normalizeAdminUserRole(payload.Role)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	user.Login = login
	user.Role = role
	user.Active = payload.Active

	if user.IsRoot {
		user.Login = models.BootstrapAdminLogin
		user.Role = models.AdminUserRoleAdmin
		user.Active = true
		user.IsRoot = true
	}

	if !user.IsRoot && strings.TrimSpace(payload.Password) != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(payload.Password)), bcrypt.DefaultCost)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось обновить пароль пользователя"})
		}
		user.PasswordHash = string(hash)
	}

	if err := h.db.Save(&user).Error; err != nil {
		if isUniqueConstraintError(err) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "пользователь с таким логином уже существует"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось сохранить пользователя"})
	}

	return c.JSON(toAdminUserResponse(user))
}

func toAdminUserResponse(user models.AdminUser) adminUserResponse {
	return adminUserResponse{
		ID:        user.ID,
		Login:     user.Login,
		Role:      user.Role,
		Active:    user.Active,
		IsRoot:    user.IsRoot,
		CreatedAt: user.CreatedAt.Format(timeLayoutSeconds),
		UpdatedAt: user.UpdatedAt.Format(timeLayoutSeconds),
	}
}

func normalizeLogin(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizeAdminUserRole(value string) (string, error) {
	role := strings.ToLower(strings.TrimSpace(value))
	switch role {
	case models.AdminUserRoleAdmin, models.AdminUserRoleHR:
		return role, nil
	default:
		return "", errors.New("некорректная роль пользователя")
	}
}

func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}

	return strings.Contains(strings.ToLower(err.Error()), "unique")
}
