<?php
require_once __DIR__ . '/helpers.php';
require_module('usuarios');

$action = $_GET['action'] ?? '';
$ROLES = ['administrador', 'cajero', 'mesero', 'domiciliario'];
$MODULOS = ['mesas', 'pedidos', 'caja', 'domicilios', 'menu', 'inventario', 'reportes'];

if (method() === 'GET' && $action === 'listar') {
    json_ok(['usuarios' => db()->query('SELECT id, nombre, iniciales, rol, activo FROM usuarios ORDER BY activo DESC, rol, nombre')->fetchAll()]);
}

if (method() === 'POST' && $action === 'guardar') {
    $b = body();
    $id = (int)($b['id'] ?? 0);
    $nombre = trim((string)($b['nombre'] ?? ''));
    $iniciales = strtoupper(trim((string)($b['iniciales'] ?? '')));
    $rol = $b['rol'] ?? '';
    $pin = (string)($b['pin'] ?? '');

    if ($nombre === '' || $iniciales === '' || !in_array($rol, $ROLES, true)) json_error('Completa nombre, iniciales y rol.');
    if (!$id && strlen($pin) < 4) json_error('Define un PIN de al menos 4 dígitos para el nuevo usuario.');

    if ($id) {
        if ($pin !== '') {
            db()->prepare('UPDATE usuarios SET nombre=?, iniciales=?, rol=?, pin_hash=? WHERE id=?')
                ->execute([$nombre, $iniciales, $rol, password_hash($pin, PASSWORD_BCRYPT), $id]);
        } else {
            db()->prepare('UPDATE usuarios SET nombre=?, iniciales=?, rol=? WHERE id=?')->execute([$nombre, $iniciales, $rol, $id]);
        }
    } else {
        db()->prepare('INSERT INTO usuarios (nombre, iniciales, rol, pin_hash) VALUES (?,?,?,?)')
            ->execute([$nombre, $iniciales, $rol, password_hash($pin, PASSWORD_BCRYPT)]);
        $id = (int)db()->lastInsertId();
    }
    json_ok(['id' => $id]);
}

if (method() === 'POST' && $action === 'desactivar') {
    $b = body();
    db()->prepare('UPDATE usuarios SET activo = 1 - activo WHERE id=?')->execute([(int)($b['id'] ?? 0)]);
    json_ok([]);
}

if (method() === 'GET' && $action === 'permisos') {
    $rows = db()->query('SELECT rol, modulo, permitido FROM permisos_rol')->fetchAll();
    $matrix = [];
    foreach ($rows as $r) $matrix[$r['rol']][$r['modulo']] = (bool)$r['permitido'];
    json_ok(['modulos' => $MODULOS, 'roles' => $ROLES, 'matrix' => $matrix]);
}

if (method() === 'POST' && $action === 'guardar_permiso') {
    $b = body();
    $rol = $b['rol'] ?? '';
    $modulo = $b['modulo'] ?? '';
    $permitido = !empty($b['permitido']) ? 1 : 0;
    if ($rol === 'administrador') json_error('El rol administrador siempre tiene todos los permisos.');
    if (!in_array($rol, $ROLES, true) || !in_array($modulo, $MODULOS, true)) json_error('Rol o módulo inválido.');

    $stmt = db()->prepare('INSERT INTO permisos_rol (rol, modulo, permitido) VALUES (?,?,?) ON DUPLICATE KEY UPDATE permitido = VALUES(permitido)');
    $stmt->execute([$rol, $modulo, $permitido]);
    json_ok([]);
}

json_error('Acción no encontrada.', 404);
