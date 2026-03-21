package handlers

import (
	"strings"

	"glass-factory/internal/models"

	"github.com/gofiber/fiber/v2"
)

type contactPayload struct {
	Phones       string  `json:"phones"`
	Email        string  `json:"email"`
	Address      string  `json:"address"`
	MapLatitude  float64 `json:"mapLatitude"`
	MapLongitude float64 `json:"mapLongitude"`
	MapURL       string  `json:"mapUrl"`
	VK           string  `json:"vk"`
	Telegram     string  `json:"telegram"`
	WhatsApp     string  `json:"whatsapp"`
}

type contactResponse struct {
	Phones       string   `json:"phones"`
	PhonesList   []string `json:"phonesList"`
	Email        string   `json:"email"`
	Address      string   `json:"address"`
	MapLatitude  float64  `json:"mapLatitude"`
	MapLongitude float64  `json:"mapLongitude"`
	MapURL       string   `json:"mapUrl"`
	VK           string   `json:"vk"`
	Telegram     string   `json:"telegram"`
	WhatsApp     string   `json:"whatsapp"`
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
	contact.MapLatitude = payload.MapLatitude
	contact.MapLongitude = payload.MapLongitude
	contact.MapURL = strings.TrimSpace(payload.MapURL)
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

func toContactResponse(contact models.Contact) contactResponse {
	return contactResponse{
		Phones:       contact.Phones,
		PhonesList:   models.SplitLines(contact.Phones),
		Email:        contact.Email,
		Address:      contact.Address,
		MapLatitude:  contact.MapLatitude,
		MapLongitude: contact.MapLongitude,
		MapURL:       contact.MapURL,
		VK:           contact.VK,
		Telegram:     contact.Telegram,
		WhatsApp:     contact.WhatsApp,
	}
}
