<?php
/**
 * Instalador de un solo uso:
 *   1) Si config/local.php no existe, pide los datos de la base de datos
 *      (los que te dio hPanel) y los guarda ahí mismo, en el servidor.
 *      Ese archivo nunca se sube a GitHub (está en .gitignore).
 *   2) Crea las tablas (sql/schema.sql) y fija los PIN reales de los
 *      usuarios semilla mediante password_hash().
 *
 * Súbelo a Hostinger, ábrelo una vez desde el navegador, y BÓRRALO.
 *
 * PINs por defecto tras instalar:
 *   María Torres (administrador) -> 1111
 *   Carlos Pérez (mesero)        -> 2222
 *   Ana Gómez (cajero)           -> 3333
 *   Luis Ramírez (domiciliario)  -> 4444
 */

require_once __DIR__ . '/config/config.php';

$localPath = __DIR__ . '/config/local.php';

function render_form(string $error = ''): void {
    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Instalar Sabor Real POS</title>
    <style>
      body{font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;padding:0 20px;color:#222}
      label{display:block;margin-top:14px;font-weight:600;font-size:13px}
      input{width:100%;padding:10px;margin-top:4px;border:1px solid #ccc;border-radius:8px;box-sizing:border-box}
      button{margin-top:20px;padding:12px 18px;background:#d6541c;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer}
      .error{background:#fde2e2;color:#a12727;padding:10px 14px;border-radius:8px;margin-top:16px}
      .hint{color:#666;font-size:12px;margin-top:4px}
    </style>
    </head>
    <body>
      <h2>Configurar base de datos</h2>
      <p>Ingresa los datos que te dio hPanel → Base de datos. Se guardan en <code>config/local.php</code>, directamente en el servidor (nunca se suben a GitHub).</p>
      <?php if ($error): ?><div class="error"><?= htmlspecialchars($error) ?></div><?php endif; ?>
      <form method="post">
        <label>Host<input name="db_host" value="localhost" required></label>
        <label>Nombre de la base de datos<input name="db_name" placeholder="u252316858_sabor_real_pos" required></label>
        <label>Usuario<input name="db_user" placeholder="u252316858_sabor_real" required></label>
        <label>Contraseña<input name="db_pass" type="password" required></label>
        <div class="hint">Estos datos se validan conectando a la base de datos antes de guardarlos.</div>
        <button type="submit">Guardar y continuar</button>
      </form>
    </body>
    </html>
    <?php
    exit;
}

if (!file_exists($localPath)) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $host = trim($_POST['db_host'] ?? '');
        $name = trim($_POST['db_name'] ?? '');
        $user = trim($_POST['db_user'] ?? '');
        $pass = (string)($_POST['db_pass'] ?? '');

        if ($host === '' || $name === '' || $user === '') {
            render_form('Completa host, nombre de la base de datos y usuario.');
        }

        try {
            new PDO("mysql:host=$host;dbname=$name;charset=utf8mb4", $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
        } catch (PDOException $e) {
            render_form('No se pudo conectar con esos datos: ' . $e->getMessage());
        }

        $php = "<?php\n"
            . "define('DB_HOST', " . var_export($host, true) . ");\n"
            . "define('DB_NAME', " . var_export($name, true) . ");\n"
            . "define('DB_USER', " . var_export($user, true) . ");\n"
            . "define('DB_PASS', " . var_export($pass, true) . ");\n";

        if (file_put_contents($localPath, $php) === false) {
            render_form('No se pudo escribir config/local.php. Revisa los permisos de la carpeta config/.');
        }

        // config.php ya se cargó en este request con los valores por defecto
        // (require_once no lo vuelve a leer), así que redirigimos para que la
        // siguiente petición arranque limpia y sí recoja config/local.php.
        header('Location: install.php');
        exit;
    } else {
        render_form();
    }
}

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

if (@unlink(__FILE__)) {
    echo "\nListo. Este instalador se autoeliminó del servidor por seguridad.\n";
} else {
    echo "\nListo. No pude autoeliminarme (permisos de archivo) — borra install.php manualmente desde el Administrador de archivos.\n";
}
