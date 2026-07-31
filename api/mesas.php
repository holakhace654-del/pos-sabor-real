<?php
require_once __DIR__ . '/helpers.php';
require_module('mesas');

$action = $_GET['action'] ?? '';

if (method() === 'GET' && $action === 'listar') {
    $zonas = db()->query('SELECT id, nombre FROM zonas_salon ORDER BY orden')->fetchAll();
    $mesas = db()->query('SELECT id, zona_id, nombre, puestos, estado, pos_x, pos_y, forma,
        TIMESTAMPDIFF(MINUTE, ocupada_desde, NOW()) AS minutos
        FROM mesas ORDER BY id')->fetchAll();

    foreach ($zonas as &$z) {
        $z['mesas'] = array_values(array_filter($mesas, fn($m) => (int)$m['zona_id'] === (int)$z['id']));
    }

    $paraLlevarActivos = db()->query("SELECT COUNT(*) FROM pedidos WHERE canal='para_llevar' AND estado_pago='abierto'")->fetchColumn();
    $domiciliosActivos = db()->query("SELECT COUNT(*) FROM pedidos WHERE canal='domicilio' AND estado_pago='abierto'")->fetchColumn();

    json_ok([
        'zonas' => $zonas,
        'resumen' => [
            'para_llevar_activos' => (int)$paraLlevarActivos,
            'domicilios_activos' => (int)$domiciliosActivos,
        ],
    ]);
}

/** Abre una mesa: retorna el pedido abierto existente o crea uno nuevo */
if (method() === 'POST' && $action === 'abrir') {
    $u = require_module('mesas');
    $b = body();
    $mesaId = (int)($b['mesa_id'] ?? 0);
    if (!$mesaId) json_error('Falta la mesa.');

    $mesa = db()->prepare('SELECT * FROM mesas WHERE id = ?');
    $mesa->execute([$mesaId]);
    $mesa = $mesa->fetch();
    if (!$mesa) json_error('Mesa no encontrada.', 404);

    $pedido = db()->prepare("SELECT id FROM pedidos WHERE mesa_id = ? AND estado_pago = 'abierto' ORDER BY id DESC LIMIT 1");
    $pedido->execute([$mesaId]);
    $pedidoId = $pedido->fetchColumn();

    if (!$pedidoId) {
        $ins = db()->prepare("INSERT INTO pedidos (codigo, canal, mesa_id, mesero_id) VALUES (?, 'mesa', ?, ?)");
        $ins->execute([$mesa['nombre'], $mesaId, $u['id']]);
        $pedidoId = db()->lastInsertId();

        db()->prepare("UPDATE mesas SET estado='ocupada', ocupada_desde=NOW() WHERE id=? AND estado='libre'")->execute([$mesaId]);
    }

    json_ok(['pedido_id' => (int)$pedidoId]);
}

/** Crea (o retoma) un pedido para llevar */
if (method() === 'POST' && $action === 'para_llevar') {
    $u = require_module('mesas');
    $codigo = 'PLL-' . str_pad((string)(db()->query("SELECT COUNT(*)+1 FROM pedidos WHERE canal='para_llevar'")->fetchColumn()), 3, '0', STR_PAD_LEFT);
    $ins = db()->prepare("INSERT INTO pedidos (codigo, canal, mesero_id) VALUES (?, 'para_llevar', ?)");
    $ins->execute([$codigo, $u['id']]);
    json_ok(['pedido_id' => (int)db()->lastInsertId()]);
}

/** Cambia el estado de una mesa manualmente (uso administrativo) */
if (method() === 'POST' && $action === 'cambiar_estado') {
    require_role(['administrador', 'cajero']);
    $b = body();
    $mesaId = (int)($b['mesa_id'] ?? 0);
    $estado = $b['estado'] ?? '';
    $estadosValidos = ['libre', 'ocupada', 'cuenta', 'reservada'];
    if (!$mesaId || !in_array($estado, $estadosValidos, true)) json_error('Mesa o estado inválido.');

    $pedidoAbierto = db()->prepare("SELECT id FROM pedidos WHERE mesa_id = ? AND estado_pago = 'abierto'");
    $pedidoAbierto->execute([$mesaId]);
    $pedidoId = $pedidoAbierto->fetchColumn();

    if ($estado === 'libre') {
        // Liberar la mesa a mano anula el pedido abierto si lo hay (ej: pedido creado por error)
        if ($pedidoId) {
            db()->prepare("UPDATE pedidos SET estado_pago = 'anulado' WHERE id = ?")->execute([$pedidoId]);
        }
        db()->prepare("UPDATE mesas SET estado='libre', ocupada_desde=NULL WHERE id=?")->execute([$mesaId]);
    } elseif ($estado === 'reservada') {
        if ($pedidoId) json_error('No puedes reservar una mesa con un pedido abierto. Libérala primero.');
        db()->prepare("UPDATE mesas SET estado='reservada', ocupada_desde=NULL WHERE id=?")->execute([$mesaId]);
    } elseif ($estado === 'ocupada') {
        db()->prepare("UPDATE mesas SET estado='ocupada', ocupada_desde=COALESCE(ocupada_desde, NOW()) WHERE id=?")->execute([$mesaId]);
    } else { // cuenta
        db()->prepare("UPDATE mesas SET estado='cuenta' WHERE id=?")->execute([$mesaId]);
    }

    json_ok([]);
}

json_error('Acción no encontrada.', 404);
