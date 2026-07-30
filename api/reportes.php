<?php
require_once __DIR__ . '/helpers.php';
require_module('reportes');

$action = $_GET['action'] ?? '';

if (method() === 'GET' && $action === 'resumen') {
    $fecha = $_GET['fecha'] ?? date('Y-m-d');
    $canal = $_GET['canal'] ?? null;

    $where = 'DATE(cobrado_en) = ? AND estado_pago = "cobrado"';
    $params = [$fecha];
    if ($canal) { $where .= ' AND canal = ?'; $params[] = $canal; }

    $stmt = db()->prepare("SELECT COALESCE(SUM(total),0) AS ventas, COUNT(*) AS ordenes FROM pedidos WHERE $where");
    $stmt->execute($params);
    $row = $stmt->fetch();
    $ventas = (int)$row['ventas'];
    $ordenes = (int)$row['ordenes'];
    $ticketProm = $ordenes ? round($ventas / $ordenes) : 0;

    $stmtTiempo = db()->prepare("SELECT AVG(TIMESTAMPDIFF(MINUTE, creado_en, cobrado_en)) FROM pedidos
        WHERE canal='domicilio' AND estado_domicilio='entregado' AND DATE(cobrado_en) = ?");
    $stmtTiempo->execute([$fecha]);
    $tiempoProm = round((float)$stmtTiempo->fetchColumn());

    // Ventas por hora (8am - 10pm)
    $stmtHoras = db()->prepare("SELECT HOUR(cobrado_en) AS h, SUM(total) AS t FROM pedidos WHERE $where GROUP BY HOUR(cobrado_en)");
    $stmtHoras->execute($params);
    $porHora = array_fill(8, 15, 0);
    foreach ($stmtHoras->fetchAll() as $r) { if (isset($porHora[(int)$r['h']])) $porHora[(int)$r['h']] = (int)$r['t']; }
    $max = max(1, max($porHora));
    $salesBars = [];
    foreach ($porHora as $hora => $total) {
        $salesBars[] = ['hora' => $hora, 'total' => $total, 'pct' => round($total / $max * 100)];
    }

    // Más vendidos
    $stmtTop = db()->prepare("SELECT pi.nombre_producto, SUM(pi.cantidad) AS cant FROM pedido_items pi
        JOIN pedidos p ON p.id = pi.pedido_id
        WHERE DATE(p.cobrado_en) = ? AND p.estado_pago='cobrado'" . ($canal ? ' AND p.canal = ?' : '') . "
        GROUP BY pi.nombre_producto ORDER BY cant DESC LIMIT 6");
    $stmtTop->execute($canal ? [$fecha, $canal] : [$fecha]);
    $topProductos = $stmtTop->fetchAll();

    // Desempeño mesero / domiciliario
    $stmtMeseros = db()->prepare("SELECT u.nombre, u.rol, COUNT(*) AS cant, SUM(p.total) AS total
        FROM pedidos p JOIN usuarios u ON u.id = p.mesero_id
        WHERE DATE(p.cobrado_en) = ? AND p.estado_pago='cobrado' GROUP BY u.id ORDER BY total DESC");
    $stmtMeseros->execute([$fecha]);
    $meseros = $stmtMeseros->fetchAll();

    $stmtDomi = db()->prepare("SELECT u.nombre, u.rol, COUNT(*) AS cant,
        AVG(TIMESTAMPDIFF(MINUTE, p.creado_en, p.cobrado_en)) AS tiempo_prom
        FROM pedidos p JOIN usuarios u ON u.id = p.domiciliario_id
        WHERE DATE(p.cobrado_en) = ? AND p.estado_pago='cobrado' AND p.canal='domicilio' GROUP BY u.id");
    $stmtDomi->execute([$fecha]);
    $domiciliarios = $stmtDomi->fetchAll();

    $staff = array_merge(
        array_map(fn($m) => ['name' => $m['nombre'], 'role' => $m['rol'], 'metric' => $m['cant'] . ' pedidos atendidos', 'total' => money_cop($m['total'])], $meseros),
        array_map(fn($d) => ['name' => $d['nombre'], 'role' => $d['rol'], 'metric' => $d['cant'] . ' entregas', 'total' => round($d['tiempo_prom']) . ' min prom.'], $domiciliarios)
    );

    // Cierre de caja del turno más reciente (abierto o cerrado)
    $turno = db()->query('SELECT * FROM caja_turnos ORDER BY id DESC LIMIT 1')->fetch();

    json_ok([
        'kpis' => [
            ['label' => 'Ventas', 'value' => money_cop($ventas)],
            ['label' => 'Órdenes', 'value' => (string)$ordenes],
            ['label' => 'Ticket promedio', 'value' => money_cop($ticketProm)],
            ['label' => 'Tiempo entrega prom.', 'value' => $tiempoProm . ' min'],
        ],
        'sales_bars' => array_values($salesBars),
        'top_productos' => $topProductos,
        'staff' => $staff,
        'turno' => $turno ?: null,
    ]);
}

json_error('Acción no encontrada.', 404);
