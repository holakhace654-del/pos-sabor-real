<?php
// Configuración central.
//
// Las credenciales reales de la base de datos NO se guardan aquí porque este
// archivo se sube a un repositorio público en GitHub. En su lugar, viven en
// config/local.php, un archivo que solo existe en el servidor (Hostinger) y
// que está en .gitignore, así que nunca se sube ni queda visible para nadie.
//
// Para producción (Hostinger): crea config/local.php directamente en el
// Administrador de archivos del panel, con este contenido (con tus datos
// reales de hPanel → Base de datos):
//
//   <?php
//   define('DB_HOST', 'localhost');
//   define('DB_NAME', 'u252316858_sabor_real_pos');
//   define('DB_USER', 'u252316858_sabor_real');
//   define('DB_PASS', 'tu-contraseña-real');
//
if (file_exists(__DIR__ . '/local.php')) {
    require __DIR__ . '/local.php';
}

// Valores por defecto para desarrollo local (XAMPP, etc.) si no existe local.php
if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_NAME')) define('DB_NAME', 'sabor_real_pos');
if (!defined('DB_USER')) define('DB_USER', 'root');
if (!defined('DB_PASS')) define('DB_PASS', '');
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
