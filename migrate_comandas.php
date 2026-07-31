<?php
/**
 * Migración de un solo uso: agrega el sistema de "comandas" (tickets de
 * cocina independientes por envío) sobre una base de datos que ya estaba
 * usando el modelo anterior (un solo estado_cocina por pedido).
 *
 * Qué hace:
 *   1) Crea la tabla `comandas` si no existe.
 *   2) Agrega la columna `pedido_items.comanda_id` si no existe.
 *   3) Para cada pedido que ya tenía enviado_cocina_en, crea UNA comanda
 *      con su estado actual y le asigna todos sus ítems (comportamiento
 *      histórico: antes todo iba en un solo ticket). De aquí en adelante,
 *      cada "Enviar a cocina" crea una comanda nueva solo con lo nuevo.
 *
 * Súbelo a Hostinger, ábrelo una vez desde el navegador, y se autoelimina.
 */
require_once __DIR__ . '/config/db.php';

header('Content-Type: text/plain; charset=utf-8');

$pdo = db();

function column_exists(PDO $pdo, string $table, string $column): bool {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?");
    $stmt->execute([$table, $column]);
    return (bool)$stmt->fetchColumn();
}

function table_exists(PDO $pdo, string $table): bool {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ?");
    $stmt->execute([$table]);
    return (bool)$stmt->fetchColumn();
}

if (!table_exists($pdo, 'comandas')) {
    $pdo->exec("CREATE TABLE comandas (
        id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        pedido_id         INT UNSIGNED NOT NULL,
        estado            ENUM('pendiente','preparacion','listo') NOT NULL DEFAULT 'pendiente',
        creado_en         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    echo "Tabla comandas creada.\n";
} else {
    echo "Tabla comandas ya existía, no se toca.\n";
}

if (!column_exists($pdo, 'pedido_items', 'comanda_id')) {
    $pdo->exec("ALTER TABLE pedido_items
        ADD COLUMN comanda_id INT UNSIGNED NULL AFTER producto_id,
        ADD FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE SET NULL");
    echo "Columna pedido_items.comanda_id agregada.\n";
} else {
    echo "Columna pedido_items.comanda_id ya existía, no se toca.\n";
}

// Backfill: agrupa en una sola comanda histórica los pedidos que ya
// habían sido enviados a cocina bajo el modelo anterior.
$pedidos = $pdo->query("SELECT id, estado_cocina, enviado_cocina_en FROM pedidos
    WHERE enviado_cocina_en IS NOT NULL")->fetchAll();

$migrados = 0;
foreach ($pedidos as $p) {
    $yaTiene = $pdo->prepare('SELECT COUNT(*) FROM comandas WHERE pedido_id = ?');
    $yaTiene->execute([$p['id']]);
    if ($yaTiene->fetchColumn() > 0) continue; // ya migrado en una corrida anterior

    $sinComanda = $pdo->prepare('SELECT COUNT(*) FROM pedido_items WHERE pedido_id = ? AND comanda_id IS NULL');
    $sinComanda->execute([$p['id']]);
    if (!$sinComanda->fetchColumn()) continue; // no tiene ítems que migrar

    $ins = $pdo->prepare('INSERT INTO comandas (pedido_id, estado, creado_en) VALUES (?, ?, ?)');
    $ins->execute([$p['id'], $p['estado_cocina'], $p['enviado_cocina_en']]);
    $comandaId = $pdo->lastInsertId();

    $pdo->prepare('UPDATE pedido_items SET comanda_id = ? WHERE pedido_id = ? AND comanda_id IS NULL')
        ->execute([$comandaId, $p['id']]);

    $migrados++;
}

echo "$migrados pedido(s) migrados a su comanda histórica.\n";

if (@unlink(__FILE__)) {
    echo "\nListo. Este script se autoeliminó del servidor.\n";
} else {
    echo "\nListo. Bórralo manualmente del servidor por seguridad.\n";
}
