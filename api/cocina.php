<?php
require_once __DIR__ . '/helpers.php';
require_module('pedidos');

$action = $_GET['action'] ?? '';

if (method() === 'GET' && $action === 'comandas') {
    $pedidos = db()->query("SELECT p.id, p.codigo, p.canal, p.estado_cocina, p.mesa_id,
        TIMESTAMPDIFF(MINUTE, p.enviado_cocina_en, NOW()) AS minutos,
        m.nombre AS mesa_nombre
        FROM pedidos p LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.enviado_cocina_en IS NOT NULL AND p.estado_pago = 'abierto'
        ORDER BY p.enviado_cocina_en ASC")->fetchAll();

    if ($pedidos) {
        $ids = array_column($pedidos, 'id');
        $in = implode(',', array_fill(0, count($ids), '?'));
        $stmt = db()->prepare("SELECT pedido_id, nombre_producto, cantidad FROM pedido_items WHERE pedido_id IN ($in) ORDER BY id");
        $stmt->execute($ids);
        $items = [];
        foreach ($stmt->fetchAll() as $it) $items[$it['pedido_id']][] = $it;
    }

    $labels = ['mesa' => 'Mesa', 'para_llevar' => 'Para llevar', 'domicilio' => 'Domicilio'];
    foreach ($pedidos as &$p) {
        $p['ref'] = $p['canal'] === 'mesa' ? $p['mesa_nombre'] : $p['codigo'];
        $p['type_label'] = $labels[$p['canal']] ?? $p['canal'];
        $p['items'] = $items[$p['id']] ?? [];
    }

    json_ok(['comandas' => $pedidos]);
}

if (method() === 'POST' && $action === 'avanzar') {
    $b = body();
    $pedidoId = (int)($b['pedido_id'] ?? 0);
    $orden = ['pendiente', 'preparacion', 'listo'];

    $stmt = db()->prepare('SELECT estado_cocina, canal, estado_domicilio FROM pedidos WHERE id = ?');
    $stmt->execute([$pedidoId]);
    $pedido = $stmt->fetch();
    if (!$pedido) json_error('Pedido no encontrado.', 404);

    $idx = array_search($pedido['estado_cocina'], $orden, true);
    if ($idx === false || $idx >= count($orden) - 1) json_error('La comanda ya está lista.');
    $siguiente = $orden[$idx + 1];

    db()->prepare('UPDATE pedidos SET estado_cocina = ? WHERE id = ?')->execute([$siguiente, $pedidoId]);

    if ($siguiente === 'listo' && $pedido['canal'] === 'domicilio' && $pedido['estado_domicilio'] === 'preparacion') {
        db()->prepare("UPDATE pedidos SET estado_domicilio = 'listo_despacho' WHERE id = ?")->execute([$pedidoId]);
    }
    if ($pedido['canal'] === 'domicilio' && $pedido['estado_domicilio'] === 'recibido') {
        db()->prepare("UPDATE pedidos SET estado_domicilio = 'preparacion' WHERE id = ?")->execute([$pedidoId]);
    }

    json_ok([]);
}

json_error('Acción no encontrada.', 404);
