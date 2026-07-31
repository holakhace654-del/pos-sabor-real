<?php
require_once __DIR__ . '/helpers.php';
require_module('pedidos');

$action = $_GET['action'] ?? '';

if (method() === 'GET' && $action === 'comandas') {
    $comandas = db()->query("SELECT c.id, c.estado AS estado_cocina, c.pedido_id,
        TIMESTAMPDIFF(MINUTE, c.creado_en, NOW()) AS minutos,
        p.codigo, p.canal, p.mesa_id,
        m.nombre AS mesa_nombre
        FROM comandas c
        JOIN pedidos p ON p.id = c.pedido_id
        LEFT JOIN mesas m ON m.id = p.mesa_id
        WHERE p.estado_pago = 'abierto'
        ORDER BY c.creado_en ASC")->fetchAll();

    if ($comandas) {
        $ids = array_column($comandas, 'id');
        $in = implode(',', array_fill(0, count($ids), '?'));
        $stmt = db()->prepare("SELECT comanda_id, nombre_producto, cantidad FROM pedido_items WHERE comanda_id IN ($in) ORDER BY id");
        $stmt->execute($ids);
        $items = [];
        foreach ($stmt->fetchAll() as $it) $items[$it['comanda_id']][] = $it;
    }

    $labels = ['mesa' => 'Mesa', 'para_llevar' => 'Para llevar', 'domicilio' => 'Domicilio'];
    foreach ($comandas as &$c) {
        $c['ref'] = $c['canal'] === 'mesa' ? $c['mesa_nombre'] : $c['codigo'];
        $c['type_label'] = $labels[$c['canal']] ?? $c['canal'];
        $c['items'] = $items[$c['id']] ?? [];
    }

    json_ok(['comandas' => $comandas]);
}

if (method() === 'POST' && $action === 'avanzar') {
    $b = body();
    $comandaId = (int)($b['comanda_id'] ?? 0);
    $orden = ['pendiente', 'preparacion', 'listo'];

    $stmt = db()->prepare('SELECT c.estado, c.pedido_id, p.canal, p.estado_domicilio
        FROM comandas c JOIN pedidos p ON p.id = c.pedido_id WHERE c.id = ?');
    $stmt->execute([$comandaId]);
    $comanda = $stmt->fetch();
    if (!$comanda) json_error('Comanda no encontrada.', 404);

    $idx = array_search($comanda['estado'], $orden, true);
    if ($idx === false || $idx >= count($orden) - 1) json_error('La comanda ya está lista.');
    $siguiente = $orden[$idx + 1];

    db()->prepare('UPDATE comandas SET estado = ? WHERE id = ?')->execute([$siguiente, $comandaId]);

    $pedidoId = $comanda['pedido_id'];
    if ($siguiente === 'listo' && $comanda['canal'] === 'domicilio' && $comanda['estado_domicilio'] === 'preparacion') {
        db()->prepare("UPDATE pedidos SET estado_domicilio = 'listo_despacho' WHERE id = ?")->execute([$pedidoId]);
    }
    if ($comanda['canal'] === 'domicilio' && $comanda['estado_domicilio'] === 'recibido') {
        db()->prepare("UPDATE pedidos SET estado_domicilio = 'preparacion' WHERE id = ?")->execute([$pedidoId]);
    }

    json_ok([]);
}

json_error('Acción no encontrada.', 404);
