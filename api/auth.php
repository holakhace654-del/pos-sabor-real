<?php
require_once __DIR__ . '/helpers.php';

$action = $_GET['action'] ?? '';

if (method() === 'GET' && $action === 'usuarios') {
    // Lista de usuarios activos para la pantalla de selección de login
    $stmt = db()->query("SELECT id, nombre, iniciales, rol FROM usuarios WHERE activo = 1 ORDER BY rol, nombre");
    json_ok(['usuarios' => $stmt->fetchAll()]);
}

if (method() === 'GET' && $action === 'me') {
    $u = current_user();
    if (!$u) json_error('No autenticado.', 401);
    json_ok(['usuario' => $u, 'permisos' => modulos_permitidos($u['rol'])]);
}

if (method() === 'POST' && $action === 'login') {
    $b = body();
    $usuarioId = (int)($b['usuario_id'] ?? 0);
    $pin = (string)($b['pin'] ?? '');

    if (!$usuarioId || strlen($pin) < 4) json_error('Selecciona un usuario e ingresa tu PIN.');

    $stmt = db()->prepare('SELECT id, nombre, iniciales, rol, pin_hash FROM usuarios WHERE id = ? AND activo = 1');
    $stmt->execute([$usuarioId]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($pin, $row['pin_hash'])) {
        json_error('PIN incorrecto.', 401);
    }

    unset($row['pin_hash']);
    $_SESSION['user'] = $row;
    session_regenerate_id(true);
    $_SESSION['user'] = $row; // re-set tras regenerar id

    json_ok(['usuario' => $row, 'permisos' => modulos_permitidos($row['rol'])]);
}

if (method() === 'POST' && $action === 'logout') {
    $_SESSION = [];
    session_destroy();
    json_ok([]);
}

json_error('Acción no encontrada.', 404);
