# aig-bor-glass-factory-vacansy-go-fiber

## Bootstrap admin

Пароль главного администратора больше не хранится в коде.

Если `hrautomotive_admin` еще не создан в пустой базе, задайте одноразово:

```bash
BOOTSTRAP_ADMIN_PASSWORD='your-strong-password'
```

При следующем запуске сервер создаст главного пользователя. После этого переменная больше не нужна.
