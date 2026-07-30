<?php
require_once __DIR__ . '/helpers.php';

$action = $_GET['action'] ?? '';

if (method() === 'GET' && $action === 'zonas') {
    require_module('domicilios');
    json_ok(['zonas' => db()->query('SELECT id, nombre, costo FROM zonas_envio ORDER BY nombre')->fetchAll()]);
}

if (method() === 'GET' && $action === 'domiciliarios') {
    require_module('domicilios');
    $rows = db()->query("SELECT u.id, u.nombre, u.iniciales,
        EXISTS(SELECT 1 FROM pedidos p WHERE p.domiciliario_id=u.id AND p.estado_domicilio='en_camino') AS en_ruta
        FROM usuarios u WHERE u.rol='domiciliario' AND u.activo=1 ORDER BY u.nombre")->fetchAll();
    foreach ($rows as &$r) $r['estado'] = $r['en_ruta'] ? 'En ruta' : 'Disponible';
    json_ok(['domiciliarios' => $rows]);
}

/** Lista de domicilios activos (para el panel de despacho) */
if (method() === 'GET' && $action === 'activos') {
    require_module('domicilios');
    $rows = db()->query("SELECT p.id, p.codigo, p.estado_domicilio, p.estado_cocina, p.total, p.creado_en,
        c.nombre AS cliente, c.direccion, c.telefono,
        u.nombre AS domiciliario, u.iniciales AS domiciliario_iniciales
        FROM pedidos p
        LEFT JOIN clientes c ON c.id = p.cliente_id
        LEFT JOIN usuarios u ON u.id = p.domiciliario_id
        WHERE p.canal='domicilio' AND p.estado_domicilio IS NOT NULL AND p.estado_domicilio <> 'entregado'
        ORDER BY p.creado_en DESC")->fetchAll();
    json_ok(['domicilios' => $rows]);
}

if (method() === 'GET' && $action === 'seguimiento') {
    require_module('domicilios');
    $id = (int)($_GET['id'] ?? 0);
    json_ok(['pedido' => domicilio_detalle($id)]);
}

/** Crea un nuevo pedido de domicilio (cliente + costo de envío + domiciliario) */
if (method() === 'POST' && $action === 'crear') {
    $u = require_module('domicilios');
    $b = body();
    $clienteId = (int)($b['cliente_id'] ?? 0);
    $zonaId = (int)($b['zona_envio_id'] ?? 0);
    $domiciliarioId = !empty($b['domiciliario_id']) ? (int)$b['domiciliario_id'] : null;

    if (!$clienteId) json_error('Falta el cliente.');

    $costo = 0;
    if ($zonaId) {
        $stmt = db()->prepare('SELECT costo FROM zonas_envio WHERE id = ?');
        $stmt->execute([$zonaId]);
        $costo = (int)$stmt->fetchColumn();
    }

    $codigo = '#' . (1000 + (int)db()->query('SELECT COUNT(*)+1 FROM pedidos WHERE canal="domicilio"')->fetchColumn());

    $stmt = db()->prepare("INSERT INTO pedidos (codigo, canal, cliente_id, mesero_id, domiciliario_id, costo_envio, subtotal, total, estado_domicilio)
        VALUES (?, 'domicilio', ?, ?, ?, ?, 0, ?, 'recibido')");
    $stmt->execute([$codigo, $clienteId, $u['id'], $domiciliarioId, $costo, $costo]);
    $pedidoId = (int)db()->lastInsertId();

    json_ok(['pedido_id' => $pedidoId]);
}

if (method() === 'POST' && $action === 'asignar_domiciliario') {
    require_module('domicilios');
    $b = body();
    db()->prepare('UPDATE pedidos SET domiciliario_id=? WHERE id=?')
        ->execute([(int)($b['domiciliario_id'] ?? 0) ?: null, (int)($b['pedido_id'] ?? 0)]);
    json_ok(['pedido' => domicilio_detalle((int)($b['pedido_id'] ?? 0))]);
}

/** Avanza manualmente el estado de despacho (recibido→...→en_camino), hecho por caja/admin */
if (method() === 'POST' && $action === 'avanzar_estado') {
    require_module('domicilios');
    $b = body();
    $pedidoId = (int)($b['pedido_id'] ?? 0);
    $orden = ['recibido', 'preparacion', 'listo_despacho', 'en_camino', 'entregado'];

    $stmt = db()->prepare('SELECT estado_domicilio FROM pedidos WHERE id = ?');
    $stmt->execute([$pedidoId]);
    $actual = $stmt->fetchColumn();
    $idx = array_search($actual, $orden, true);
    if ($idx === false || $idx >= count($orden) - 1) json_error('El pedido ya está en su estado final.');

    $siguiente = $orden[$idx + 1];
    marcar_estado_domicilio($pedidoId, $siguiente);
    json_ok(['pedido' => domicilio_detalle($pedidoId)]);
}

/** Vista del domiciliario: sus entregas activas */
if (method() === 'GET' && $action === 'mis_entregas') {
    $u = require_auth();
    $stmt = db()->prepare("SELECT p.id, p.codigo, p.estado_domicilio, p.total,
        c.nombre AS cliente, c.direccion, c.telefono
        FROM pedidos p LEFT JOIN clientes c ON c.id = p.cliente_id
        WHERE p.domiciliario_id = ? AND p.estado_domicilio IN ('listo_despacho','en_camino')
        ORDER BY p.creado_en");
    $stmt->execute([$u['id']]);
    json_ok(['entregas' => $stmt->fetchAll()]);
}

/** El domiciliario marca una entrega como completada (cobro contraentrega en efectivo) */
if (method() === 'POST' && $action === 'marcar_entregado') {
    $u = require_role(['domiciliario', 'administrador']);
    $b = body();
    $pedidoId = (int)($b['pedido_id'] ?? 0);

    $stmt = db()->prepare('SELECT domiciliario_id, total FROM pedidos WHERE id = ?');
    $stmt->execute([$pedidoId]);
    $pedido = $stmt->fetch();
    if (!$pedido) json_error('Pedido no encontrado.', 404);
    if ($u['rol'] === 'domiciliario' && (int)$pedido['domiciliario_id'] !== (int)$u['id']) {
        json_error('Esta entrega no está asignada a ti.', 403);
    }

    marcar_estado_domicilio($pedidoId, 'entregado');
    db()->prepare("UPDATE pedidos SET estado_pago='cobrado', metodo_pago='efectivo', recibido=total, cambio=0, cobrado_en=NOW() WHERE id=?")
        ->execute([$pedidoId]);

    json_ok([]);
}

json_error('Acción no encontrada.', 404);

function marcar_estado_domicilio(int $pedidoId, string $estado): void {
    db()->prepare('UPDATE pedidos SET estado_domicilio = ? WHERE id = ?')->execute([$estado, $pedidoId]);
}

function domicilio_detalle(int $id): ?array {
    $stmt = db()->prepare('SELECT p.*, c.nombre AS cliente, c.telefono, c.direccion, c.referencia,
        u.nombre AS domiciliario, u.iniciales AS domiciliario_iniciales
        FROM pedidos p
        LEFT JOIN clientes c ON c.id = p.cliente_id
        LEFT JOIN usuarios u ON u.id = p.domiciliario_id
        WHERE p.id = ?');
    $stmt->execute([$id]);
    $pedido = $stmt->fetch();
    if (!$pedido) return null;
    $items = db()->prepare('SELECT * FROM pedido_items WHERE pedido_id = ?');
    $items->execute([$id]);
    $pedido['items'] = $items->fetchAll();
    return $pedido;
}
