<?php
// Configuración central. En Hostinger: crea la base de datos desde hPanel
// y reemplaza estos valores con los que te entregue el panel.

define('DB_HOST', 'localhost');
define('DB_NAME', 'sabor_real_pos');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

define('APP_NAME', 'Sabor Real');
define('APP_TIMEZONE', 'America/Bogota');

// Carpeta donde se guardan las fotos de productos (relativa a la raíz del sitio)
define('UPLOADS_DIR', __DIR__ . '/../uploads/productos');
define('UPLOADS_URL', '/uploads/productos');

date_default_timezone_set(APP_TIMEZONE);

// Sesiones: en hosting compartido con múltiples tablets, cada dispositivo
// mantiene su propia sesión de navegador (cookie de sesión PHP estándar).
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 12, // 12 horas de turno
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}
