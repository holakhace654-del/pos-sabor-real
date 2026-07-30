<?php
/**
 * Instalador de un solo uso: crea las tablas (sql/schema.sql) y fija los
 * PIN reales de los usuarios semilla mediante password_hash().
 * Súbelo a Hostinger, ábrelo una vez desde el navegador, y BÓRRALO.
 *
 * PINs por defecto tras instalar:
 *   María Torres (administrador) -> 1111
 *   Carlos Pérez (mesero)        -> 2222
 *   Ana Gómez (cajero)           -> 3333
 *   Luis Ramírez (domiciliario)  -> 4444
 */
require_once __DIR__ . '/config/db.php';

header('Content-Type: text/plain; charset=utf-8');

$pdo = db();
$sql = file_get_contents(__DIR__ . '/sql/schema.sql');

// Quita las líneas de comentario "-- ..." antes de partir por sentencias,
// para que un bloque de comentario pegado al inicio de una sentencia no la anule.
$sinComentarios = preg_replace('/^--.*$/m', '', $sql);
$statements = array_filter(array_map('trim', explode(";", $sinComentarios)));

$pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
foreach ($statements as $stmt) {
    if ($stmt === '') continue;
    try {
        $pdo->exec($stmt);
    } catch (PDOException $e) {
        echo "Aviso al ejecutar sentencia (posiblemente ya existía): " . $e->getMessage() . "\n";
    }
}
$pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

echo "Esquema y datos semilla cargados.\n\n";

$pines = [
    'MT' => '1111',
    'CP' => '2222',
    'AG' => '3333',
    'LR' => '4444',
];

foreach ($pines as $iniciales => $pin) {
    $hash = password_hash($pin, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('UPDATE usuarios SET pin_hash = ? WHERE iniciales = ?');
    $stmt->execute([$hash, $iniciales]);
    echo "PIN de $iniciales fijado a $pin\n";
}

echo "\nListo. Elimina install.php del servidor por seguridad.\n";
