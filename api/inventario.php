<?php
require_once __DIR__ . '/helpers.php';
require_module('inventario');

$action = $_GET['action'] ?? '';

if (method() === 'GET' && $action === 'listar') {
    $insumos = db()->query('SELECT * FROM insumos ORDER BY nombre')->fetchAll();
    $recetas = db()->query('SELECT r.insumo_id, p.nombre FROM receta_producto r JOIN productos p ON p.id = r.producto_id')->fetchAll();

    $usos = [];
    foreach ($recetas as $r) $usos[$r['insumo_id']][] = $r['nombre'];

    foreach ($insumos as &$i) {
        $i['stock_actual'] = (float)$i['stock_actual'];
        $i['stock_minimo'] = (float)$i['stock_minimo'];
        $i['stock_meta'] = (float)$i['stock_meta'];
        $i['pct'] = $i['stock_meta'] > 0 ? min(100, round($i['stock_actual'] / $i['stock_meta'] * 100)) : 0;
        $i['bajo_stock'] = $i['stock_actual'] <= $i['stock_minimo'];
        $i['usado_en'] = implode(', ', $usos[$i['id']] ?? []) ?: '—';
    }

    $bajos = array_values(array_filter($insumos, fn($i) => $i['bajo_stock']));
    json_ok(['insumos' => $insumos, 'bajos' => $bajos]);
}

if (method() === 'POST' && $action === 'guardar') {
    $b = body();
    $id = (int)($b['id'] ?? 0);
    $nombre = trim((string)($b['nombre'] ?? ''));
    $unidad = trim((string)($b['unidad'] ?? 'kg'));
    $stockActual = (float)($b['stock_actual'] ?? 0);
    $stockMinimo = (float)($b['stock_minimo'] ?? 0);
    $stockMeta = (float)($b['stock_meta'] ?? 0);
    if ($nombre === '') json_error('El nombre del insumo es obligatorio.');

    if ($id) {
        db()->prepare('UPDATE insumos SET nombre=?, unidad=?, stock_actual=?, stock_minimo=?, stock_meta=? WHERE id=?')
            ->execute([$nombre, $unidad, $stockActual, $stockMinimo, $stockMeta, $id]);
    } else {
        db()->prepare('INSERT INTO insumos (nombre, unidad, stock_actual, stock_minimo, stock_meta) VALUES (?,?,?,?,?)')
            ->execute([$nombre, $unidad, $stockActual, $stockMinimo, $stockMeta]);
        $id = (int)db()->lastInsertId();
    }
    json_ok(['id' => $id]);
}

if (method() === 'POST' && $action === 'movimiento') {
    $b = body();
    $insumoId = (int)($b['insumo_id'] ?? 0);
    $tipo = $b['tipo'] ?? 'entrada';
    $cantidad = abs((float)($b['cantidad'] ?? 0));
    $motivo = trim((string)($b['motivo'] ?? ''));
    if (!in_array($tipo, ['entrada', 'salida', 'ajuste'], true)) json_error('Tipo de movimiento inválido.');
    if ($cantidad <= 0) json_error('La cantidad debe ser mayor a cero.');

    $delta = $tipo === 'salida' ? -$cantidad : $cantidad;
    db()->prepare('UPDATE insumos SET stock_actual = GREATEST(0, stock_actual + ?) WHERE id = ?')->execute([$delta, $insumoId]);
    db()->prepare('INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, motivo) VALUES (?,?,?,?)')
        ->execute([$insumoId, $tipo, $cantidad, $motivo]);

    $stmt = db()->prepare('SELECT * FROM insumos WHERE id = ?');
    $stmt->execute([$insumoId]);
    json_ok(['insumo' => $stmt->fetch()]);
}

if (method() === 'POST' && $action === 'eliminar') {
    $b = body();
    db()->prepare('DELETE FROM insumos WHERE id=?')->execute([(int)($b['id'] ?? 0)]);
    json_ok([]);
}

json_error('Acción no encontrada.', 404);
