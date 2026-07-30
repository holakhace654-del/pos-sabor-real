<?php
require_once __DIR__ . '/helpers.php';

$action = $_GET['action'] ?? '';

if (method() === 'GET' && $action === 'listar') {
    require_auth();
    json_ok(['categorias' => db()->query('SELECT id, nombre, orden FROM categorias ORDER BY orden')->fetchAll()]);
}

if (method() === 'POST' && $action === 'guardar') {
    require_module('menu');
    $b = body();
    $id = (int)($b['id'] ?? 0);
    $nombre = trim((string)($b['nombre'] ?? ''));
    if ($nombre === '') json_error('El nombre de la categoría es obligatorio.');

    if ($id) {
        db()->prepare('UPDATE categorias SET nombre=? WHERE id=?')->execute([$nombre, $id]);
    } else {
        $orden = (int)db()->query('SELECT COALESCE(MAX(orden),0)+1 FROM categorias')->fetchColumn();
        db()->prepare('INSERT INTO categorias (nombre, orden) VALUES (?,?)')->execute([$nombre, $orden]);
        $id = (int)db()->lastInsertId();
    }
    json_ok(['id' => $id]);
}

if (method() === 'POST' && $action === 'eliminar') {
    require_module('menu');
    $b = body();
    $id = (int)($b['id'] ?? 0);
    $enUso = db()->prepare('SELECT COUNT(*) FROM productos WHERE categoria_id=?');
    $enUso->execute([$id]);
    if ($enUso->fetchColumn() > 0) json_error('No puedes eliminar una categoría con productos asociados.');
    db()->prepare('DELETE FROM categorias WHERE id=?')->execute([$id]);
    json_ok([]);
}

json_error('Acción no encontrada.', 404);
