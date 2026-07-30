<?php
require_once __DIR__ . '/helpers.php';
require_module('caja');

$action = $_GET['action'] ?? '';

if (method() === 'GET' && $action === 'turno') {
    $turno = db()->query("SELECT ct.*, u.nombre AS usuario_nombre FROM caja_turnos ct
        JOIN usuarios u ON u.id = ct.usuario_id WHERE ct.estado='abierto' ORDER BY ct.id DESC LIMIT 1")->fetch();
    json_ok(['turno' => $turno ?: null]);
}

if (method() === 'POST' && $action === 'abrir_turno') {
    $u = require_module('caja');
    $existente = db()->query("SELECT id FROM caja_turnos WHERE estado='abierto' LIMIT 1")->fetchColumn();
    if ($existente) json_error('Ya hay una caja abierta.');

    $b = body();
    $base = max(0, (int)($b['base_inicial'] ?? 0));
    $stmt = db()->prepare('INSERT INTO caja_turnos (usuario_id, base_inicial) VALUES (?, ?)');
    $stmt->execute([$u['id'], $base]);
    json_ok(['turno_id' => (int)db()->lastInsertId()]);
}

if (method() === 'POST' && $action === 'cerrar_turno') {
    require_module('caja');
    $b = body();
    $turno = db()->query("SELECT * FROM caja_turnos WHERE estado='abierto' ORDER BY id DESC LIMIT 1")->fetch();
    if (!$turno) json_error('No hay una caja abierta.');

    $ventasEfectivo = db()->prepare("SELECT COALESCE(SUM(total),0) FROM pedidos WHERE caja_turno_id = ? AND metodo_pago = 'efectivo' AND estado_pago='cobrado'");
    $ventasEfectivo->execute([$turno['id']]);
    $ventasEfectivo = (int)$ventasEfectivo->fetchColumn();

    $esperado = (int)$turno['base_inicial'] + $ventasEfectivo;
    $contado = max(0, (int)($b['efectivo_contado'] ?? 0));
    $diferencia = $contado - $esperado;

    db()->prepare("UPDATE caja_turnos SET cerrado_en=NOW(), efectivo_esperado=?, efectivo_contado=?, diferencia=?, estado='cerrado' WHERE id=?")
        ->execute([$esperado, $contado, $diferencia, $turno['id']]);

    json_ok(['esperado' => $esperado, 'contado' => $contado, 'diferencia' => $diferencia]);
}

if (method() === 'POST' && $action === 'cobrar') {
    require_module('caja');
    $b = body();
    $pedidoId = (int)($b['pedido_id'] ?? 0);
    $metodo = $b['metodo_pago'] ?? 'efectivo';
    $recibido = max(0, (int)($b['recibido'] ?? 0));

    if (!in_array($metodo, ['efectivo', 'tarjeta', 'transferencia'], true)) json_error('Método de pago inválido.');

    $pedido = db()->prepare('SELECT * FROM pedidos WHERE id = ?');
    $pedido->execute([$pedidoId]);
    $pedido = $pedido->fetch();
    if (!$pedido) json_error('Pedido no encontrado.', 404);
    if ($pedido['estado_pago'] !== 'abierto') json_error('Este pedido ya fue cobrado.');
    if (!$pedido['total']) json_error('El pedido no tiene ítems.');

    if ($metodo === 'efectivo' && $recibido < (int)$pedido['total']) {
        json_error('El monto recibido no cubre el total.');
    }
    if ($metodo !== 'efectivo') $recibido = (int)$pedido['total'];

    $turno = db()->query("SELECT id FROM caja_turnos WHERE estado='abierto' ORDER BY id DESC LIMIT 1")->fetchColumn();
    $cambio = $metodo === 'efectivo' ? $recibido - (int)$pedido['total'] : 0;

    db()->prepare("UPDATE pedidos SET estado_pago='cobrado', metodo_pago=?, recibido=?, cambio=?, caja_turno_id=?, cobrado_en=NOW() WHERE id=?")
        ->execute([$metodo, $recibido, $cambio, $turno ?: null, $pedidoId]);

    if ($pedido['mesa_id']) {
        db()->prepare("UPDATE mesas SET estado='libre', ocupada_desde=NULL WHERE id=?")->execute([$pedido['mesa_id']]);
    }

    json_ok(['cambio' => $cambio, 'total' => (int)$pedido['total']]);
}

/** Marca una mesa/pedido con "cuenta pedida" (mesero solicitó la cuenta) */
if (method() === 'POST' && $action === 'pedir_cuenta') {
    require_auth();
    $b = body();
    $pedidoId = (int)($b['pedido_id'] ?? 0);
    $stmt = db()->prepare('SELECT mesa_id FROM pedidos WHERE id = ?');
    $stmt->execute([$pedidoId]);
    $mesaId = $stmt->fetchColumn();
    if ($mesaId) db()->prepare("UPDATE mesas SET estado='cuenta' WHERE id=?")->execute([$mesaId]);
    json_ok([]);
}

json_error('Acción no encontrada.', 404);
