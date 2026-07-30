<?php
require_once __DIR__ . '/helpers.php';

$action = $_GET['action'] ?? '';

if (method() === 'GET' && $action === 'buscar') {
    require_module('domicilios');
    $tel = trim((string)($_GET['telefono'] ?? ''));
    if ($tel === '') json_error('Ingresa un teléfono para buscar.');
    $stmt = db()->prepare('SELECT c.*, z.nombre AS zona_nombre, z.costo AS zona_costo,
        (SELECT MAX(creado_en) FROM pedidos WHERE cliente_id = c.id) AS ultimo_pedido
        FROM clientes c LEFT JOIN zonas_envio z ON z.id = c.zona_envio_id
        WHERE c.telefono = ?');
    $stmt->execute([$tel]);
    $cliente = $stmt->fetch();
    json_ok(['cliente' => $cliente ?: null]);
}

if (method() === 'POST' && $action === 'guardar') {
    require_module('domicilios');
    $b = body();
    $telefono = trim((string)($b['telefono'] ?? ''));
    $nombre = trim((string)($b['nombre'] ?? ''));
    if ($telefono === '' || $nombre === '') json_error('Nombre y teléfono son obligatorios.');

    $existente = db()->prepare('SELECT id FROM clientes WHERE telefono = ?');
    $existente->execute([$telefono]);
    $id = $existente->fetchColumn();

    $direccion = trim((string)($b['direccion'] ?? ''));
    $referencia = trim((string)($b['referencia'] ?? ''));
    $zonaId = !empty($b['zona_envio_id']) ? (int)$b['zona_envio_id'] : null;

    if ($id) {
        db()->prepare('UPDATE clientes SET nombre=?, direccion=?, referencia=?, zona_envio_id=? WHERE id=?')
            ->execute([$nombre, $direccion, $referencia, $zonaId, $id]);
    } else {
        db()->prepare('INSERT INTO clientes (nombre, telefono, direccion, referencia, zona_envio_id) VALUES (?,?,?,?,?)')
            ->execute([$nombre, $telefono, $direccion, $referencia, $zonaId]);
        $id = (int)db()->lastInsertId();
    }
    json_ok(['id' => (int)$id]);
}

json_error('Acción no encontrada.', 404);
