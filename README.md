# POS Sabor Real

Sistema de punto de venta para restaurante pequeño. PHP + MySQL en el backend,
HTML/CSS/JS sin build en el frontend. Pensado para hosting compartido (Hostinger).

## Pantallas

1. Login por PIN (`index.html`)
2. Local / mapa de mesas (`mesas.html`)
3. Toma de pedido — mesa, para llevar, domicilio (`pedido.html`)
4. Domicilios + vista del domiciliario (`domicilio.html`, `domiciliario.html`)
5. Cocina / KDS con polling (`cocina.html`)
6. Cobro / caja (`caja.html`)
7. Administración de menú (`menu.html`)
8. Inventario (`inventario.html`)
9. Reportes (`reportes.html`)
10. Usuarios y roles (`usuarios.html`)

## Despliegue en Hostinger

1. Crea la base de datos MySQL desde hPanel (Bases de datos → MySQL) y anota
   host, nombre, usuario y contraseña.
2. Sube todo el contenido de este repositorio a `public_html` (o a una
   subcarpeta) vía el Administrador de archivos, Git, o FTP.
3. Edita `config/config.php` con los datos reales de la base de datos:
   `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`.
4. Abre `https://tu-dominio.com/install.php` una sola vez en el navegador.
   Esto crea las tablas, carga los datos semilla y fija los PIN de los
   usuarios de ejemplo (ver el propio archivo para los PIN por defecto).
5. **Elimina `install.php` del servidor** inmediatamente después de instalar.
6. Entra a `index.html` y verifica que puedas iniciar sesión.

### Actualizar el sitio en Hostinger vía Git

Si conectas el hosting a este repositorio (Git en hPanel, o `git pull` por SSH),
cada actualización es: hacer commit y push aquí, y luego sincronizar/hacer pull
en el servidor. Recuerda que `install.php` solo debe ejecutarse una vez —
no lo dejes accesible públicamente después de la instalación inicial.

## Desarrollo local

Requiere PHP 8+ con PDO MySQL y un servidor MySQL. Por ejemplo con XAMPP:

```
php -S localhost:8900
```

Crea la base de datos `sabor_real_pos`, ajusta `config/config.php` si es
necesario, y visita `http://localhost:8900/install.php` una vez.
