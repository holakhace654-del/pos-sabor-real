<?php
require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json; charset=utf-8');

function json_ok($data = [], int $status = 200): void {
    http_response_code($status);
    echo json_encode(['ok' => true] + (is_array($data) ? $data : ['data' => $data]), JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $status = 400): void {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Formatea un entero COP como "$25.000" */
function money_cop($value): string {
    return '$' . number_format((float)$value, 0, ',', '.');
}

/** Usuario autenticado actual, o null */
function current_user(): ?array {
    return $_SESSION['user'] ?? null;
}

/** Exige sesión activa; corta la petición con 401 si no hay */
function require_auth(): array {
    $u = current_user();
    if (!$u) json_error('No autenticado.', 401);
    return $u;
}

/** Exige que el usuario tenga uno de los roles dados */
function require_role(array $roles): array {
    $u = require_auth();
    if (!in_array($u['rol'], $roles, true)) {
        json_error('No tienes permiso para esta acción.', 403);
    }
    return $u;
}

/** Exige que el rol del usuario tenga el módulo habilitado según permisos_rol */
function require_module(string $modulo): array {
    $u = require_auth();
    if ($u['rol'] === 'administrador') return $u;
    $stmt = db()->prepare('SELECT permitido FROM permisos_rol WHERE rol = ? AND modulo = ?');
    $stmt->execute([$u['rol'], $modulo]);
    $permitido = $stmt->fetchColumn();
    if (!$permitido) json_error('Tu rol no tiene acceso a este módulo.', 403);
    return $u;
}

function method(): string {
    return $_SERVER['REQUEST_METHOD'];
}

/** Lista de módulos habilitados para un rol (administrador => todos) */
function modulos_permitidos(string $rol): array {
    $todos = ['mesas','pedidos','caja','domicilios','menu','inventario','reportes','usuarios'];
    if ($rol === 'administrador') return $todos;
    $stmt = db()->prepare('SELECT modulo FROM permisos_rol WHERE rol = ? AND permitido = 1');
    $stmt->execute([$rol]);
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}
