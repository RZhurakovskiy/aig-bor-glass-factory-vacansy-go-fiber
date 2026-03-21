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

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

const (
	AdminCookie = "glass_factory_admin"
)

type Handler struct {
	db            *gorm.DB
	adminPassword string
	sessionSecret []byte
	sessionTTL    time.Duration
}

type vacancyResponse struct {
	ID               uint       `json:"id"`
	SortOrder        int        `json:"sortOrder"`
	Title            string     `json:"title"`
	Schedule         string     `json:"schedule"`
	ScheduleLines    []string   `json:"scheduleLines"`
	Summary          string     `json:"summary"`
	Duties           string     `json:"duties"`
	DutiesList       []string   `json:"dutiesList"`
	Requirements     string     `json:"requirements"`
	RequirementsList []string   `json:"requirementsList"`
	Conditions       string     `json:"conditions"`
	ConditionsList   []string   `json:"conditionsList"`
	Salary           string     `json:"salary"`
	Active           bool       `json:"active"`
	TrashedAt        *time.Time `json:"trashedAt,omitempty"`
}

type vacancyPayload struct {
	Title        string `json:"title"`
	Schedule     string `json:"schedule"`
	Summary      string `json:"summary"`
	Duties       string `json:"duties"`
	Requirements string `json:"requirements"`
	Conditions   string `json:"conditions"`
	Salary       string `json:"salary"`
	Active       bool   `json:"active"`
}

type vacancyOrderPayload struct {
	OrderedIDs []uint `json:"orderedIds"`
}

type contactPayload struct {
	Phones   string `json:"phones"`
	Email    string `json:"email"`
	Address  string `json:"address"`
	VK       string `json:"vk"`
	Telegram string `json:"telegram"`
	WhatsApp string `json:"whatsapp"`
}

type contactResponse struct {
	Phones     string   `json:"phones"`
	PhonesList []string `json:"phonesList"`
	Email      string   `json:"email"`
	Address    string   `json:"address"`
	VK         string   `json:"vk"`
	Telegram   string   `json:"telegram"`
	WhatsApp   string   `json:"whatsapp"`
}

func New(db *gorm.DB, adminPassword string, sessionSecret []byte, sessionTTL time.Duration) *Handler {
	return &Handler{
		db:            db,
		adminPassword: adminPassword,
		sessionSecret: sessionSecret,
		sessionTTL:    sessionTTL,
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

func (h *Handler) GetPublicVacancies(c *fiber.Ctx) error {
	var vacancies []models.Vacancy
	if err := h.db.Where("active = ? AND trashed_at IS NULL", true).Order("sort_order asc, id asc").Find(&vacancies).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить список вакансий"})
	}

	response := make([]vacancyResponse, 0, len(vacancies))
	for _, vacancy := range vacancies {
		response = append(response, toVacancyResponse(vacancy))
	}

	return c.JSON(response)
}

func (h *Handler) GetAdminVacancies(c *fiber.Ctx) error {
	var vacancies []models.Vacancy
	if err := h.db.Where("trashed_at IS NULL").Order("sort_order asc, id asc").Find(&vacancies).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить список вакансий"})
	}

	response := make([]vacancyResponse, 0, len(vacancies))
	for _, vacancy := range vacancies {
		response = append(response, toVacancyResponse(vacancy))
	}

	return c.JSON(response)
}

func (h *Handler) GetAdminTrashVacancies(c *fiber.Ctx) error {
	var vacancies []models.Vacancy
	if err := h.db.Where("trashed_at IS NOT NULL").Order("trashed_at desc, id desc").Find(&vacancies).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось получить корзину вакансий"})
	}

	response := make([]vacancyResponse, 0, len(vacancies))
	for _, vacancy := range vacancies {
		response = append(response, toVacancyResponse(vacancy))
	}

	return c.JSON(response)
}

func (h *Handler) CreateVacancy(c *fiber.Ctx) error {
	var payload vacancyPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректные данные вакансии"})
	}

	title := strings.TrimSpace(payload.Title)
	if title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "название вакансии обязательно"})
	}

	sortOrder, err := h.nextVacancySortOrder()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось создать вакансию"})
	}

	vacancy := models.Vacancy{
		SortOrder:    sortOrder,
		Title:        title,
		Schedule:     normalizeMultiline(payload.Schedule),
		Summary:      strings.TrimSpace(payload.Summary),
		Duties:       normalizeMultiline(payload.Duties),
		Requirements: normalizeMultiline(payload.Requirements),
		Conditions:   normalizeMultiline(payload.Conditions),
		Salary:       strings.TrimSpace(payload.Salary),
		Active:       payload.Active,
		TrashedAt:    nil,
	}

	if err := h.db.Create(&vacancy).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось создать вакансию"})
	}

	return c.Status(fiber.StatusCreated).JSON(toVacancyResponse(vacancy))
}

func (h *Handler) UpdateVacancy(c *fiber.Ctx) error {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный идентификатор вакансии"})
	}

	var vacancy models.Vacancy
	if err := h.db.Where("trashed_at IS NULL").First(&vacancy, id).Error; err != nil {
		return respondDBError(c, err)
	}

	var payload vacancyPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректные данные вакансии"})
	}

	title := strings.TrimSpace(payload.Title)
	if title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "название вакансии обязательно"})
	}

	vacancy.Title = title
	vacancy.Schedule = normalizeMultiline(payload.Schedule)
	vacancy.Summary = strings.TrimSpace(payload.Summary)
	vacancy.Duties = normalizeMultiline(payload.Duties)
	vacancy.Requirements = normalizeMultiline(payload.Requirements)
	vacancy.Conditions = normalizeMultiline(payload.Conditions)
	vacancy.Salary = strings.TrimSpace(payload.Salary)
	vacancy.Active = payload.Active

	if err := h.db.Save(&vacancy).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось сохранить вакансию"})
	}

	return c.JSON(toVacancyResponse(vacancy))
}

func (h *Handler) DeleteVacancy(c *fiber.Ctx) error {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный идентификатор вакансии"})
	}

	var vacancy models.Vacancy
	if err := h.db.Where("trashed_at IS NULL").First(&vacancy, id).Error; err != nil {
		return respondDBError(c, err)
	}

	now := time.Now()
	vacancy.Active = false
	vacancy.TrashedAt = &now

	if err := h.db.Save(&vacancy).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось переместить вакансию в корзину"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) PurgeVacancy(c *fiber.Ctx) error {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный идентификатор вакансии"})
	}

	result := h.db.Where("trashed_at IS NOT NULL").Delete(&models.Vacancy{}, id)
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось удалить вакансию навсегда"})
	}
	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "вакансия в корзине не найдена"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) RestoreVacancy(c *fiber.Ctx) error {
	id, err := parseUintParam(c, "id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный идентификатор вакансии"})
	}

	var vacancy models.Vacancy
	if err := h.db.Where("trashed_at IS NOT NULL").First(&vacancy, id).Error; err != nil {
		return respondDBError(c, err)
	}

	sortOrder, err := h.nextVacancySortOrder()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось восстановить вакансию"})
	}

	vacancy.TrashedAt = nil
	vacancy.SortOrder = sortOrder

	if err := h.db.Save(&vacancy).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось восстановить вакансию"})
	}

	return c.JSON(toVacancyResponse(vacancy))
}

func (h *Handler) EmptyTrashVacancies(c *fiber.Ctx) error {
	if err := h.db.Where("trashed_at IS NOT NULL").Delete(&models.Vacancy{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось очистить корзину"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) ReorderVacancies(c *fiber.Ctx) error {
	var payload vacancyOrderPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный порядок вакансий"})
	}

	if len(payload.OrderedIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "список вакансий пуст"})
	}

	var count int64
	if err := h.db.Model(&models.Vacancy{}).Where("trashed_at IS NULL").Count(&count).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось изменить порядок вакансий"})
	}

	if int64(len(payload.OrderedIDs)) != count {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "передан неполный список вакансий"})
	}

	seen := make(map[uint]struct{}, len(payload.OrderedIDs))
	for _, id := range payload.OrderedIDs {
		if id == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректный идентификатор вакансии"})
		}
		if _, ok := seen[id]; ok {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "в порядке вакансий есть дубликаты"})
		}
		seen[id] = struct{}{}
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		for index, id := range payload.OrderedIDs {
			if err := tx.Model(&models.Vacancy{}).Where("id = ?", id).Update("sort_order", index+1).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось изменить порядок вакансий"})
	}

	return h.GetAdminVacancies(c)
}

func (h *Handler) GetContacts(c *fiber.Ctx) error {
	contact, err := h.getContact()
	if err != nil {
		return respondDBError(c, err)
	}

	return c.JSON(toContactResponse(contact))
}

func (h *Handler) UpdateContacts(c *fiber.Ctx) error {
	contact, err := h.getContact()
	if err != nil {
		return respondDBError(c, err)
	}

	var payload contactPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "некорректные контактные данные"})
	}

	contact.Phones = normalizeMultiline(payload.Phones)
	contact.Email = strings.TrimSpace(payload.Email)
	contact.Address = strings.TrimSpace(payload.Address)
	contact.VK = strings.TrimSpace(payload.VK)
	contact.Telegram = strings.TrimSpace(payload.Telegram)
	contact.WhatsApp = strings.TrimSpace(payload.WhatsApp)

	if err := h.db.Save(&contact).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "не удалось сохранить контакты"})
	}

	return c.JSON(toContactResponse(contact))
}

func (h *Handler) getContact() (models.Contact, error) {
	var contact models.Contact
	err := h.db.First(&contact, 1).Error
	return contact, err
}

func toVacancyResponse(v models.Vacancy) vacancyResponse {
	return vacancyResponse{
		ID:               v.ID,
		SortOrder:        v.SortOrder,
		Title:            v.Title,
		Schedule:         v.Schedule,
		ScheduleLines:    models.SplitLines(v.Schedule),
		Summary:          v.Summary,
		Duties:           v.Duties,
		DutiesList:       models.SplitLines(v.Duties),
		Requirements:     v.Requirements,
		RequirementsList: models.SplitLines(v.Requirements),
		Conditions:       v.Conditions,
		ConditionsList:   models.SplitLines(v.Conditions),
		Salary:           v.Salary,
		Active:           v.Active,
		TrashedAt:        v.TrashedAt,
	}
}

func toContactResponse(contact models.Contact) contactResponse {
	return contactResponse{
		Phones:     contact.Phones,
		PhonesList: models.SplitLines(contact.Phones),
		Email:      contact.Email,
		Address:    contact.Address,
		VK:         contact.VK,
		Telegram:   contact.Telegram,
		WhatsApp:   contact.WhatsApp,
	}
}

func normalizeMultiline(value string) string {
	return models.JoinLines(strings.Split(strings.ReplaceAll(value, "\r\n", "\n"), "\n"))
}

func parseUintParam(c *fiber.Ctx, name string) (uint, error) {
	value, err := strconv.ParseUint(c.Params(name), 10, 64)
	return uint(value), err
}

func (h *Handler) nextVacancySortOrder() (int, error) {
	var vacancy models.Vacancy
	err := h.db.Order("sort_order desc, id desc").First(&vacancy).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 1, nil
	}
	if err != nil {
		return 0, err
	}
	return vacancy.SortOrder + 1, nil
}

func respondDBError(c *fiber.Ctx, err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "запись не найдена"})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "внутренняя ошибка сервера"})
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
