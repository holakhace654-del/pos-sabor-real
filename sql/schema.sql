-- =====================================================================
-- POS Sabor Real -- esquema MySQL (compatible con hosting compartido)
-- Motor InnoDB, utf8mb4. Moneda: COP, enteros sin decimales.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- USUARIOS Y ROLES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  iniciales     VARCHAR(4) NOT NULL,
  rol           ENUM('administrador','cajero','mesero','domiciliario') NOT NULL,
  pin_hash      VARCHAR(255) NOT NULL,
  activo        TINYINT(1) NOT NULL DEFAULT 1,
  creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Matriz de permisos por rol (módulos habilitados)
CREATE TABLE IF NOT EXISTS permisos_rol (
  rol           ENUM('administrador','cajero','mesero','domiciliario') NOT NULL,
  modulo        VARCHAR(40) NOT NULL,
  permitido     TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (rol, modulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- SALÓN / MESAS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zonas_salon (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(60) NOT NULL,
  orden         INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mesas (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  zona_id       INT UNSIGNED NOT NULL,
  nombre        VARCHAR(30) NOT NULL,
  puestos       TINYINT UNSIGNED NOT NULL DEFAULT 4,
  estado        ENUM('libre','ocupada','cuenta','reservada') NOT NULL DEFAULT 'libre',
  pos_x         INT NULL,
  pos_y         INT NULL,
  forma         ENUM('circulo','cuadrado') NOT NULL DEFAULT 'cuadrado',
  ocupada_desde DATETIME NULL,
  FOREIGN KEY (zona_id) REFERENCES zonas_salon(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- MENÚ: categorías, productos, modificadores
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(60) NOT NULL,
  orden         INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS productos (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  categoria_id      INT UNSIGNED NOT NULL,
  nombre            VARCHAR(120) NOT NULL,
  descripcion       VARCHAR(255) NULL,
  precio            INT UNSIGNED NOT NULL, -- COP sin decimales
  foto              VARCHAR(255) NULL,
  disponible        TINYINT(1) NOT NULL DEFAULT 1,
  aplica_domicilio  TINYINT(1) NOT NULL DEFAULT 1,
  orden             INT UNSIGNED NOT NULL DEFAULT 0,
  creado_en         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS grupos_modificadores (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id       INT UNSIGNED NOT NULL,
  nombre            VARCHAR(80) NOT NULL, -- ej: "Término de la carne"
  tipo              ENUM('unico','multiple') NOT NULL DEFAULT 'unico', -- unico=radio, multiple=checkbox
  obligatorio       TINYINT(1) NOT NULL DEFAULT 0,
  orden             INT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opciones_modificador (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  grupo_id          INT UNSIGNED NOT NULL,
  nombre            VARCHAR(80) NOT NULL,
  precio_extra      INT NOT NULL DEFAULT 0,
  orden             INT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (grupo_id) REFERENCES grupos_modificadores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- CLIENTES (domicilios)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  telefono      VARCHAR(30) NOT NULL,
  direccion     VARCHAR(255) NULL,
  referencia    VARCHAR(255) NULL,
  zona_envio_id INT UNSIGNED NULL,
  creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_telefono (telefono)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS zonas_envio (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(60) NOT NULL,
  costo         INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- CAJA (turnos / arqueo)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS caja_turnos (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id        INT UNSIGNED NOT NULL,
  base_inicial      INT UNSIGNED NOT NULL DEFAULT 0,
  abierto_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrado_en        DATETIME NULL,
  efectivo_esperado INT UNSIGNED NULL,
  efectivo_contado  INT UNSIGNED NULL,
  diferencia        INT NULL,
  estado            ENUM('abierto','cerrado') NOT NULL DEFAULT 'abierto',
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- PEDIDOS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo            VARCHAR(20) NOT NULL, -- ej: "Mesa 4", "#PLL-12", "#1042"
  canal             ENUM('mesa','para_llevar','domicilio') NOT NULL,
  mesa_id           INT UNSIGNED NULL,
  cliente_id        INT UNSIGNED NULL,
  mesero_id         INT UNSIGNED NULL,
  domiciliario_id   INT UNSIGNED NULL,
  caja_turno_id     INT UNSIGNED NULL,
  estado_cocina     ENUM('pendiente','preparacion','listo') NOT NULL DEFAULT 'pendiente',
  estado_domicilio  ENUM('recibido','preparacion','listo_despacho','en_camino','entregado') NULL,
  estado_pago       ENUM('abierto','cobrado','anulado') NOT NULL DEFAULT 'abierto',
  metodo_pago       ENUM('efectivo','tarjeta','transferencia') NULL,
  notas             VARCHAR(255) NULL,
  costo_envio       INT UNSIGNED NOT NULL DEFAULT 0,
  subtotal          INT UNSIGNED NOT NULL DEFAULT 0,
  total             INT UNSIGNED NOT NULL DEFAULT 0,
  recibido          INT UNSIGNED NULL,
  cambio            INT UNSIGNED NULL,
  creado_en         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviado_cocina_en DATETIME NULL,
  cobrado_en        DATETIME NULL,
  FOREIGN KEY (mesa_id) REFERENCES mesas(id),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (mesero_id) REFERENCES usuarios(id),
  FOREIGN KEY (domiciliario_id) REFERENCES usuarios(id),
  FOREIGN KEY (caja_turno_id) REFERENCES caja_turnos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pedido_items (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id         INT UNSIGNED NOT NULL,
  producto_id       INT UNSIGNED NOT NULL,
  nombre_producto   VARCHAR(120) NOT NULL, -- snapshot
  cantidad          SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  precio_unitario   INT UNSIGNED NOT NULL, -- snapshot incl. modificadores
  nota              VARCHAR(255) NULL,
  subtotal          INT UNSIGNED NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pedido_item_modificadores (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_item_id    INT UNSIGNED NOT NULL,
  nombre_grupo      VARCHAR(80) NOT NULL,
  nombre_opcion     VARCHAR(80) NOT NULL,
  precio_extra      INT NOT NULL DEFAULT 0,
  FOREIGN KEY (pedido_item_id) REFERENCES pedido_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- INVENTARIO / RECETAS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insumos (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  unidad        VARCHAR(20) NOT NULL DEFAULT 'kg', -- kg, und, lt...
  stock_actual  DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_minimo  DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_meta    DECIMAL(10,2) NOT NULL DEFAULT 0, -- referencia para % de barra
  creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS receta_producto (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id   INT UNSIGNED NOT NULL,
  insumo_id     INT UNSIGNED NOT NULL,
  cantidad      DECIMAL(10,3) NOT NULL, -- consumo por unidad vendida
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  insumo_id     INT UNSIGNED NOT NULL,
  tipo          ENUM('entrada','salida','ajuste') NOT NULL,
  cantidad      DECIMAL(10,2) NOT NULL,
  motivo        VARCHAR(255) NULL,
  creado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- SEED DATA -- acorde al diseño de referencia (restaurante "Sabor Real")
-- =====================================================================

INSERT INTO usuarios (nombre, iniciales, rol, pin_hash) VALUES
('María Torres',   'MT', 'administrador', '$2y$10$0000000000000000000000000000000000000000000000000001'),
('Carlos Pérez',   'CP', 'mesero',        '$2y$10$0000000000000000000000000000000000000000000000000002'),
('Ana Gómez',      'AG', 'cajero',        '$2y$10$0000000000000000000000000000000000000000000000000003'),
('Luis Ramírez',   'LR', 'domiciliario',  '$2y$10$0000000000000000000000000000000000000000000000000004');
-- Los hashes reales se generan en /sql/seed_pins.php (PIN por defecto: 1111,2222,3333,4444)

INSERT INTO permisos_rol (rol, modulo, permitido) VALUES
('administrador','mesas',1),('administrador','pedidos',1),('administrador','caja',1),('administrador','domicilios',1),('administrador','menu',1),('administrador','inventario',1),('administrador','reportes',1),('administrador','usuarios',1),
('cajero','mesas',1),('cajero','pedidos',1),('cajero','caja',1),('cajero','domicilios',0),('cajero','menu',0),('cajero','inventario',0),('cajero','reportes',1),('cajero','usuarios',0),
('mesero','mesas',1),('mesero','pedidos',1),('mesero','caja',0),('mesero','domicilios',0),('mesero','menu',0),('mesero','inventario',0),('mesero','reportes',0),('mesero','usuarios',0),
('domiciliario','mesas',0),('domiciliario','pedidos',0),('domiciliario','caja',0),('domiciliario','domicilios',1),('domiciliario','menu',0),('domiciliario','inventario',0),('domiciliario','reportes',0),('domiciliario','usuarios',0);

INSERT INTO zonas_salon (nombre, orden) VALUES ('Salón principal', 1), ('Terraza', 2);

INSERT INTO mesas (zona_id, nombre, puestos, estado, pos_x, pos_y, forma, ocupada_desde) VALUES
(1,'Mesa 1',2,'libre',40,30,'circulo',null),
(1,'Mesa 2',4,'ocupada',160,30,'cuadrado',DATE_SUB(NOW(), INTERVAL 22 MINUTE)),
(1,'Mesa 3',4,'cuenta',280,30,'cuadrado',DATE_SUB(NOW(), INTERVAL 35 MINUTE)),
(1,'Mesa 4',4,'ocupada',400,30,'cuadrado',DATE_SUB(NOW(), INTERVAL 12 MINUTE)),
(1,'Mesa 5',2,'libre',520,30,'circulo',null),
(1,'Mesa 6',6,'reservada',40,160,'cuadrado',null),
(1,'Mesa 7',4,'libre',180,180,'circulo',null),
(1,'Mesa 8',2,'ocupada',320,180,'circulo',DATE_SUB(NOW(), INTERVAL 5 MINUTE)),
(2,'T1',4,'libre',null,null,'cuadrado',null),
(2,'T2',4,'ocupada',null,null,'cuadrado',DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(2,'T3',2,'libre',null,null,'cuadrado',null),
(2,'T4',6,'cuenta',null,null,'cuadrado',DATE_SUB(NOW(), INTERVAL 18 MINUTE));

INSERT INTO categorias (nombre, orden) VALUES
('Entradas',1), ('Platos fuertes',2), ('Bebidas',3), ('Postres',4);

INSERT INTO productos (categoria_id, nombre, precio, disponible, aplica_domicilio, orden) VALUES
(2,'Bandeja paisa', 32000, 1, 1, 1),
(2,'Pechuga a la plancha', 28000, 1, 1, 2),
(2,'Sancocho de gallina', 26000, 0, 0, 3),
(2,'Trucha a la parrilla', 34000, 1, 1, 4),
(1,'Empanadas x3', 12000, 1, 1, 1),
(3,'Limonada de coco', 9000, 1, 1, 1),
(3,'Jugo de mora', 8000, 1, 1, 2),
(3,'Gaseosa', 6000, 1, 1, 3),
(3,'Cerveza artesanal', 12000, 1, 1, 4),
(4,'Flan de caramelo', 10000, 1, 1, 1),
(4,'Brownie con helado', 11000, 1, 0, 2);

-- Modificadores de "Pechuga a la plancha"
INSERT INTO grupos_modificadores (producto_id, nombre, tipo, obligatorio, orden) VALUES
(2, 'Término de la carne', 'unico', 1, 1),
(2, 'Extras', 'multiple', 0, 2);
INSERT INTO opciones_modificador (grupo_id, nombre, precio_extra, orden) VALUES
(1, 'Al punto', 0, 1), (1, 'Tres cuartos', 0, 2), (1, 'Bien cocido', 0, 3),
(2, 'Sin cebolla', 0, 1), (2, 'Sin salsa', 0, 2), (2, 'Doble porción de arroz', 4000, 3);

INSERT INTO zonas_envio (nombre, costo) VALUES
('Zona norte', 5000), ('Zona centro', 4000), ('Zona sur', 7000);

INSERT INTO clientes (nombre, telefono, direccion, referencia, zona_envio_id) VALUES
('Jorge Sánchez', '3005551234', 'Cra 45 #12-30, Apto 302', 'Edificio Torres del Parque', 2),
('Diana Rojas', '3012229988', 'Calle 80 #23-10', 'Casa esquinera color blanco', 1);

INSERT INTO insumos (nombre, unidad, stock_actual, stock_minimo, stock_meta) VALUES
('Carne de res', 'kg', 8, 10, 25),
('Arroz', 'kg', 25, 5, 30),
('Limón', 'kg', 3, 5, 20),
('Aguacate', 'und', 40, 10, 45);

INSERT INTO receta_producto (producto_id, insumo_id, cantidad) VALUES
(1, 1, 0.25), (1, 2, 0.15), (1, 4, 0.5),
(6, 3, 0.1);
