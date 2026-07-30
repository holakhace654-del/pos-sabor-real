<?php
require_once __DIR__ . '/helpers.php';

$action = $_GET['action'] ?? '';

if (method() === 'GET' && $action === 'categorias') {
    require_auth();
    json_ok(['categorias' => db()->query('SELECT id, nombre FROM categorias ORDER BY orden')->fetchAll()]);
}

/** Menú completo para toma de pedido: solo productos disponibles, con modificadores */
if (method() === 'GET' && $action === 'menu') {
    require_auth();
    $productos = db()->query("SELECT id, categoria_id, nombre, precio, foto FROM productos WHERE disponible = 1 ORDER BY categoria_id, orden")->fetchAll();
    attach_modificadores($productos);
    json_ok(['productos' => $productos]);
}

/** Listado completo (incluye no disponibles) para administración */
if (method() === 'GET' && $action === 'listar_admin') {
    require_module('menu');
    $productos = db()->query("SELECT id, categoria_id, nombre, descripcion, precio, foto, disponible, aplica_domicilio FROM productos ORDER BY categoria_id, orden")->fetchAll();
    attach_modificadores($productos);
    json_ok(['productos' => $productos]);
}

if (method() === 'POST' && $action === 'guardar') {
    require_module('menu');
    $b = body();
    $id = (int)($b['id'] ?? 0);
    $categoriaId = (int)($b['categoria_id'] ?? 0);
    $nombre = trim((string)($b['nombre'] ?? ''));
    $precio = (int)($b['precio'] ?? 0);
    $descripcion = trim((string)($b['descripcion'] ?? ''));
    $disponible = !empty($b['disponible']) ? 1 : 0;
    $aplicaDomicilio = !empty($b['aplica_domicilio']) ? 1 : 0;

    if (!$categoriaId || $nombre === '' || $precio <= 0) json_error('Completa nombre, categoría y precio.');

    if ($id) {
        $stmt = db()->prepare('UPDATE productos SET categoria_id=?, nombre=?, descripcion=?, precio=?, disponible=?, aplica_domicilio=? WHERE id=?');
        $stmt->execute([$categoriaId, $nombre, $descripcion, $precio, $disponible, $aplicaDomicilio, $id]);
    } else {
        $stmt = db()->prepare('INSERT INTO productos (categoria_id, nombre, descripcion, precio, disponible, aplica_domicilio) VALUES (?,?,?,?,?,?)');
        $stmt->execute([$categoriaId, $nombre, $descripcion, $precio, $disponible, $aplicaDomicilio]);
        $id = (int)db()->lastInsertId();
    }
    json_ok(['id' => $id]);
}

if (method() === 'POST' && $action === 'subir_foto') {
    require_module('menu');
    $id = (int)($_POST['id'] ?? 0);
    if (!$id || empty($_FILES['foto'])) json_error('Falta el producto o la foto.');

    $file = $_FILES['foto'];
    if ($file['error'] !== UPLOAD_ERR_OK) json_error('Error al subir la foto.');
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $mime = mime_content_type($file['tmp_name']);
    if (!isset($allowed[$mime])) json_error('Formato de imagen no soportado (usa JPG, PNG o WEBP).');
    if ($file['size'] > 4 * 1024 * 1024) json_error('La foto no puede superar 4MB.');

    if (!is_dir(UPLOADS_DIR)) mkdir(UPLOADS_DIR, 0755, true);
    $filename = 'producto_' . $id . '_' . time() . '.' . $allowed[$mime];
    move_uploaded_file($file['tmp_name'], UPLOADS_DIR . '/' . $filename);

    db()->prepare('UPDATE productos SET foto=? WHERE id=?')->execute([$filename, $id]);
    json_ok(['foto' => $filename, 'url' => UPLOADS_URL . '/' . $filename]);
}

if (method() === 'POST' && $action === 'eliminar') {
    require_module('menu');
    $b = body();
    db()->prepare('DELETE FROM productos WHERE id=?')->execute([(int)($b['id'] ?? 0)]);
    json_ok([]);
}

if (method() === 'POST' && $action === 'toggle_disponible') {
    require_module('menu');
    $b = body();
    db()->prepare('UPDATE productos SET disponible = 1 - disponible WHERE id=?')->execute([(int)($b['id'] ?? 0)]);
    json_ok([]);
}

if (method() === 'POST' && $action === 'guardar_modificadores') {
    require_module('menu');
    $b = body();
    $productoId = (int)($b['producto_id'] ?? 0);
    $grupos = $b['grupos'] ?? [];
    if (!$productoId) json_error('Falta el producto.');

    $pdo = db();
    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM grupos_modificadores WHERE producto_id = ?')->execute([$productoId]);
    foreach ($grupos as $i => $g) {
        $stmt = $pdo->prepare('INSERT INTO grupos_modificadores (producto_id, nombre, tipo, obligatorio, orden) VALUES (?,?,?,?,?)');
        $stmt->execute([$productoId, $g['nombre'], $g['tipo'] === 'multiple' ? 'multiple' : 'unico', !empty($g['obligatorio']) ? 1 : 0, $i]);
        $grupoId = $pdo->lastInsertId();
        foreach (($g['opciones'] ?? []) as $j => $o) {
            $pdo->prepare('INSERT INTO opciones_modificador (grupo_id, nombre, precio_extra, orden) VALUES (?,?,?,?)')
                ->execute([$grupoId, $o['nombre'], (int)($o['precio_extra'] ?? 0), $j]);
        }
    }
    $pdo->commit();
    json_ok([]);
}

json_error('Acción no encontrada.', 404);

function attach_modificadores(array &$productos): void {
    if (empty($productos)) return;
    $ids = array_column($productos, 'id');
    $in = implode(',', array_fill(0, count($ids), '?'));
    $grupos = db()->prepare("SELECT * FROM grupos_modificadores WHERE producto_id IN ($in) ORDER BY orden");
    $grupos->execute($ids);
    $grupos = $grupos->fetchAll();

    $grupoIds = array_column($grupos, 'id');
    $opciones = [];
    if ($grupoIds) {
        $in2 = implode(',', array_fill(0, count($grupoIds), '?'));
        $stmt = db()->prepare("SELECT * FROM opciones_modificador WHERE grupo_id IN ($in2) ORDER BY orden");
        $stmt->execute($grupoIds);
        foreach ($stmt->fetchAll() as $o) $opciones[$o['grupo_id']][] = $o;
    }

    foreach ($grupos as &$g) $g['opciones'] = $opciones[$g['id']] ?? [];

    foreach ($productos as &$p) {
        $p['precio'] = (int)$p['precio'];
        $p['foto_url'] = $p['foto'] ? UPLOADS_URL . '/' . $p['foto'] : null;
        $p['modificadores'] = array_values(array_filter($grupos, fn($g) => (int)$g['producto_id'] === (int)$p['id']));
    }
}
