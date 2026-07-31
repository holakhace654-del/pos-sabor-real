<?php
require_once __DIR__ . '/helpers.php';

$action = $_GET['action'] ?? '';

if (method() === 'GET' && $action === 'detalle') {
    require_auth();
    $id = (int)($_GET['id'] ?? 0);
    json_ok(['pedido' => pedido_detalle($id)]);
}

/** Lista de pedidos abiertos (para "continuar" en para llevar / domicilio) */
if (method() === 'GET' && $action === 'abiertos') {
    require_auth();
    $canal = $_GET['canal'] ?? null;
    $sql = "SELECT id, codigo, canal, subtotal, total, creado_en FROM pedidos WHERE estado_pago='abierto'";
    $params = [];
    if ($canal) { $sql .= ' AND canal = ?'; $params[] = $canal; }
    $sql .= ' ORDER BY creado_en DESC';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    json_ok(['pedidos' => $stmt->fetchAll()]);
}

if (method() === 'POST' && $action === 'agregar_item') {
    require_auth();
    $b = body();
    $pedidoId = (int)($b['pedido_id'] ?? 0);
    $productoId = (int)($b['producto_id'] ?? 0);
    $cantidad = max(1, (int)($b['cantidad'] ?? 1));
    $nota = trim((string)($b['nota'] ?? ''));
    $modificadores = $b['modificadores'] ?? []; // [{nombre_grupo, nombre_opcion, precio_extra}]

    $prod = db()->prepare('SELECT nombre, precio FROM productos WHERE id = ?');
    $prod->execute([$productoId]);
    $prod = $prod->fetch();
    if (!$prod) json_error('Producto no encontrado.', 404);

    $extra = array_sum(array_map(fn($m) => (int)($m['precio_extra'] ?? 0), $modificadores));
    $precioUnitario = (int)$prod['precio'] + $extra;
    $subtotal = $precioUnitario * $cantidad;

    $pdo = db();
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('INSERT INTO pedido_items (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, nota, subtotal) VALUES (?,?,?,?,?,?,?)');
    $stmt->execute([$pedidoId, $productoId, $prod['nombre'], $cantidad, $precioUnitario, $nota, $subtotal]);
    $itemId = $pdo->lastInsertId();

    foreach ($modificadores as $m) {
        $pdo->prepare('INSERT INTO pedido_item_modificadores (pedido_item_id, nombre_grupo, nombre_opcion, precio_extra) VALUES (?,?,?,?)')
            ->execute([$itemId, $m['nombre_grupo'], $m['nombre_opcion'], (int)($m['precio_extra'] ?? 0)]);
    }
    recalcular_pedido($pedidoId);
    $pdo->commit();

    json_ok(['pedido' => pedido_detalle($pedidoId)]);
}

if (method() === 'POST' && $action === 'actualizar_item') {
    require_auth();
    $b = body();
    $itemId = (int)($b['item_id'] ?? 0);
    $cantidad = (int)($b['cantidad'] ?? 0);

    $item = db()->prepare('SELECT pedido_id, precio_unitario FROM pedido_items WHERE id = ?');
    $item->execute([$itemId]);
    $item = $item->fetch();
    if (!$item) json_error('Ítem no encontrado.', 404);

    if ($cantidad <= 0) {
        db()->prepare('DELETE FROM pedido_items WHERE id = ?')->execute([$itemId]);
    } else {
        $subtotal = $cantidad * (int)$item['precio_unitario'];
        db()->prepare('UPDATE pedido_items SET cantidad=?, subtotal=? WHERE id=?')->execute([$cantidad, $subtotal, $itemId]);
    }
    recalcular_pedido($item['pedido_id']);
    json_ok(['pedido' => pedido_detalle($item['pedido_id'])]);
}

if (method() === 'POST' && $action === 'eliminar_item') {
    require_auth();
    $b = body();
    $itemId = (int)($b['item_id'] ?? 0);
    $item = db()->prepare('SELECT pedido_id FROM pedido_items WHERE id = ?');
    $item->execute([$itemId]);
    $pedidoId = $item->fetchColumn();
    db()->prepare('DELETE FROM pedido_items WHERE id = ?')->execute([$itemId]);
    if ($pedidoId) recalcular_pedido($pedidoId);
    json_ok(['pedido' => $pedidoId ? pedido_detalle($pedidoId) : null]);
}

if (method() === 'POST' && $action === 'notas') {
    require_auth();
    $b = body();
    db()->prepare('UPDATE pedidos SET notas=? WHERE id=?')->execute([trim((string)($b['notas'] ?? '')), (int)($b['pedido_id'] ?? 0)]);
    json_ok([]);
}

if (method() === 'POST' && $action === 'enviar_cocina') {
    require_auth();
    $b = body();
    $pedidoId = (int)($b['pedido_id'] ?? 0);

    // Solo los ítems sin comanda_id son "nuevos" (agregados desde el último envío)
    $stmt = db()->prepare('SELECT id FROM pedido_items WHERE pedido_id = ? AND comanda_id IS NULL');
    $stmt->execute([$pedidoId]);
    $nuevos = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (!$nuevos) json_error('No hay productos nuevos para enviar a cocina.');

    $pdo = db();
    $pdo->beginTransaction();
    $pdo->prepare("INSERT INTO comandas (pedido_id, estado) VALUES (?, 'pendiente')")->execute([$pedidoId]);
    $comandaId = $pdo->lastInsertId();
    $in = implode(',', array_fill(0, count($nuevos), '?'));
    $pdo->prepare("UPDATE pedido_items SET comanda_id = ? WHERE id IN ($in)")->execute(array_merge([$comandaId], $nuevos));
    $pdo->commit();

    json_ok(['pedido' => pedido_detalle($pedidoId)]);
}

json_error('Acción no encontrada.', 404);

function recalcular_pedido(int $pedidoId): void {
    $pdo = db();

    $stmt = $pdo->prepare('SELECT COALESCE(SUM(subtotal),0) FROM pedido_items WHERE pedido_id = ?');
    $stmt->execute([$pedidoId]);
    $subtotal = (int)$stmt->fetchColumn();

    $stmt = $pdo->prepare('SELECT costo_envio FROM pedidos WHERE id = ?');
    $stmt->execute([$pedidoId]);
    $envio = (int)$stmt->fetchColumn();

    $pdo->prepare('UPDATE pedidos SET subtotal=?, total=? WHERE id=?')->execute([$subtotal, $subtotal + $envio, $pedidoId]);
}

function pedido_detalle(int $id): ?array {
    $pdo = db();
    $stmt = $pdo->prepare('SELECT p.*, m.nombre AS mesa_nombre, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.direccion AS cliente_direccion
        FROM pedidos p
        LEFT JOIN mesas m ON m.id = p.mesa_id
        LEFT JOIN clientes c ON c.id = p.cliente_id
        WHERE p.id = ?');
    $stmt->execute([$id]);
    $pedido = $stmt->fetch();
    if (!$pedido) return null;

    $items = $pdo->prepare('SELECT * FROM pedido_items WHERE pedido_id = ? ORDER BY id');
    $items->execute([$id]);
    $items = $items->fetchAll();

    $itemIds = array_column($items, 'id');
    $mods = [];
    if ($itemIds) {
        $in = implode(',', array_fill(0, count($itemIds), '?'));
        $stmt = $pdo->prepare("SELECT * FROM pedido_item_modificadores WHERE pedido_item_id IN ($in)");
        $stmt->execute($itemIds);
        foreach ($stmt->fetchAll() as $m) $mods[$m['pedido_item_id']][] = $m;
    }
    foreach ($items as &$it) {
        $it['modificadores'] = $mods[$it['id']] ?? [];
        $it['nota_completa'] = trim(($it['nota'] ?? '') . ' ' . implode(', ', array_column($it['modificadores'], 'nombre_opcion')));
    }

    $pedido['items'] = $items;
    return $pedido;
}
