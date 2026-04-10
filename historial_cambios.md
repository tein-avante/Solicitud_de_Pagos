# Historial de Cambios - Sistema de Solicitud de Pagos

Este archivo mantiene el detalle de las modificaciones realizadas agrupadas por fecha.

## 2026-04-10

- **Versión Directa desde Base de Datos:**
  - Se eliminó la versión harcodeada ('2.9') del Frontend (`Dashboard.jsx`) para evitar el parpadeo visual al cargar.
  - Se ajustó el `sistemaService.js` para usar la versión configurada en la BD como única fuente de verdad.
  - Se limpiaron los valores de respaldo (fallbacks) en el Backend para evitar mostrar versiones obsoletas ('2.5', '2.7') en caso de error.

- **Estado "En Trámite" para Solicitudes Pagadas (Espera de Factura):**
  - **Solicitud.js (Modelo):** Se añadió 'En Trámite' al ENUM de estatus para permitir el seguimiento de solicitudes pagadas que aún no tienen factura definitiva.
  - **SolicitudController.js:**
    - Se actualizó la máquina de estados para permitir transiciones desde `Aprobado` hacia `En Trámite`, y de `En Trámite` hacia `Pagado` o `Cerrado`.
    - Se integró el conteo de solicitudes "En Trámite" en las estadísticas del Dashboard.
  - **Dashboard.jsx:**
    - Se añadió soporte visual para el nuevo estado (color `geekblue`).
    - Se incorporaron botones de acción rápida para que Administradores y Auditores marquen solicitudes como "En Trámite" directamente desde la tabla.
    - Se actualizó el filtro de estatus (escritorio y móvil) para incluir el nuevo estado.
    - Se incluyó "En Trámite" en las opciones de generación del reporte de Relación de Solicitudes.
  - **FormularioSolicitud.jsx:**
    - Se actualizó el diseño del encabezado para mostrar el Tag correspondiente.
    - Se añadió el botón de cambio de estado en el panel de revisión para roles autorizados.

- **Persistencia de Filtros y Navegación (Mejora UX):**
  - **Dashboard.jsx:**
    - Se implementó el uso de `localStorage` para persistir los filtros de búsqueda (Proveedor, Departamento, Estatus, Centro de Costo) y la paginación (`currentPage`, `pageSize`).
    - Ahora, al regresar de ver el detalle de una solicitud, el sistema restaura automáticamente la vista exactamente como estaba.
  - **Maestros.jsx:**
    - Se aplicó persistencia al texto de búsqueda (`searchText`) y a la pestaña activa (`currentTab`), manteniendo el contexto de trabajo al editar registros.
- **Barra de Búsqueda en Tablas Maestras:**
  - **Maestros.jsx:**
    - Se implementó un estado global de búsqueda (`searchText`) que se reinicia al cambiar de pestaña (inicialmente, ahora persistido).
    - Se añadieron componentes `Input.Search` en las cuatro pestañas (Proveedores, Centros de Costo, Departamentos y Usuarios).
    - Se integró una función de filtrado dinámico (`getFilteredData`) que permite buscar por múltiples campos simultáneamente sin recargar la página:
      - **Proveedores:** Razón Social, RIF, Banco, Cuenta, Teléfono y Correo.
      - **Centros/Deptos:** Nombre y Código.
      - **Usuarios:** Nombre, Email, Cargo, Rol y Departamento.
    - El diseño de la cabecera de las tablas se ajustó para ser responsivo (`flex-wrap`) y mantener los botones de acción alineados con el buscador.

## 2026-04-09

- **Migración Total a Múltiples Centros de Costo:**
  - **scripts/drop_centro_costo_column.js:** Script creado para eliminar definitivamente la columna redundante `centroCosto` de la tabla `Solicituds`.
  - **models/Solicitud.js:** Se eliminó el campo del modelo para evitar discrepancias.
  - **frontend/src/components/FormularioSolicitud.jsx:** Se removió el selector individual de centro de costo de la interfaz. Ahora la distribución es el único medio de asignación.
  - **controllers/SolicitudController.js:**
    - **Filtros del Dashboard:** Se actualizó el método `listar` para realizar un `JOIN` con la tabla `DistribucionGastos`. El filtro por centro de costo ahora busca en toda la distribución.
    - **Reporte Excel:** Se modificó la columna de centro de costo para que concatene y muestre todos los centros asignados a la solicitud.
    - **PDF:** Se eliminó la referencia a la columna borrada y se optimizó el diseño dinámico.
    - **Corrección de Edición:** Se rediseñó el método `actualizar` para que sea capaz de gestionar cambios en la distribución de centros de costo (limpieza y re-inserción dentro de una transacción), solucionando el problema donde los cambios no se reflejaban en el PDF al editar.

- **Subida de Comprobantes en Arqueos:**
  - **ArqueoCajaChica.js (Modelo):** Se añadió el campo `comprobante` para almacenar la ruta del archivo adjunto.
  - **CajaChicaController.js:** Se modificó `performArqueo` para capturar y guardar el archivo recibido desde el frontend.
  - **FinanzasDirecto.jsx:**
    - Se integró el componente `Upload` en el modal de arqueo.
    - Se actualizó el envío de datos mediante `FormData` para soportar archivos.
    - Se añadió una columna de acciones en el historial de arqueos para visualizar los comprobantes adjuntos (icono de ojo).
  - **Rutas (caja-chica.js):** Se configuró el middleware de `multer` (`upload.single('comprobante')`) en la ruta `POST /arqueo`.

- **Corrección de timestamp en la creación de la solicitud:**
  - **SolicitudController.js:** Se corrigió el error donde la fecha de creación y el historial registraban la hora como `00:00`. Ahora se captura la hora real de la creación y se maneja una copia independiente para las validaciones de fechas sin hora límite.

- **Gestión Flexibilizada de Datos Bancarios de Proveedores:**
  - **Proveedor.js (Modelo):** Se añadieron los campos extras `bancoPago`, `telefonoPago`, `rifPago` y `emailPago`. Se dio marcha atrás a forzar un "Método principal", permitiendo guardar todas las opciones libremente.
  - **Maestros.jsx:** Se restauró el diseño de la tabla y del formulario para mostrar columnas estáticas para "Banco", "Cuenta", "Pago Móvil" y "e-pay", eliminando la dependencia de un menú desplegable de método.
  - **FormularioSolicitud.jsx:** Ajustado para que, independientemente del método, se cargue toda la información bancaria asociada al proveedor y el sistema use la correcta al momento del pago finalizado por el usuario.
  - **Migración BD:** Se ejecutó el script `migracion_pagos_proveedores.js` para añadir las columnas faltantes (teléfono, correo, RIF de pago) a los proveedores existentes sin perder datos.
  - **ProveedorController.js (Carga Masiva Excel):** Se actualizó el reporte descargable de plantilla para que incluya las nuevas columnas (Banco PM, Telf PM, RIF PM, Correo e-pay). El procesador de importación fue ajustado para identificar palabras clave y procesar correctamente todos los métodos de pago.

- **Visibilidad de Tasa BCV (Tasa del Día):**
  - **FormularioSolicitud.jsx:** Se corrigió bug crítico que impedía mostrar el campo `tasaBCV` (faltaba incluirlo en `form.setFieldsValue`). Se rediseñó el campo como un banner visual con gradiente verde para mayor visibilidad cuando la solicitud está pagada.
  - **Dashboard.jsx:** Se agregó la columna "Tasa BCV" en la tabla principal de solicitudes, posicionada después de la columna "Monto". Muestra el valor formateado en Bs con tooltip explicativo; las solicitudes sin tasa muestran un guion.
  - **SolicitudController.js (Exportación Excel):** Se agregó la columna "TASA BCV" al reporte Excel general, después de MONTO (EUROS).
  - **SolicitudController.js (Reporte PDF General):** Se agregó la columna "TASA BCV" al reporte PDF de exportación masiva.
  - **SolicitudController.js (Relación de Solicitudes PDF):** Se agregó la columna "Tasa BCV" en la relación de solicitudes agrupada por departamento.

- **Reportes con Altura Dinámica (Texto Completo):**
  - **SolicitudController.js (Reporte General PDF):** Se eliminó el truncado de texto. Ahora el sistema calcula la altura de cada fila dinámicamente según el contenido de las observaciones, ajustando bordes y fondos automáticamente para evitar solapamientos.
  - **SolicitudController.js (Relación de Solicitudes PDF):** Se eliminaron todos los límites de caracteres (`substring`). Ahora se muestran nombres de departamento, conceptos y proveedores completos. La lógica de paginación se ajustó para manejar filas de múltiples líneas sin romper el diseño.
  - **Dashboard.jsx & SolicitudController.js (Validación de Pago):** Se hizo obligatoria la Tasa BCV al marcar como 'Pagado'. Se añadió `form.validateFields()` en el frontend y una verificación de seguridad en el backend para evitar pagos sin tasa.
  - **SolicitudController.js (PDF individual):** Se eliminó la tasa BCV del PDF imprimible de cada solicitud (a petición del usuario).

- **Visualización de Proveedores Inactivos:**
  - **FormularioSolicitud.jsx:** Se corrigió el error visual donde los proveedores inactivos se mostraban como IDs numéricos en el selector. Ahora, el sistema detecta si el proveedor de la solicitud no está en la lista de activos y lo incluye dinámicamente para que su nombre se muestre correctamente.

## 2026-04-08

- **Reporte Relación de Solicitudes:**
  - Se cambió la etiqueta "BUQUE/UNIDAD" por "DEPARTAMENTO" en el encabezado del grupo.
  - Se cambió la columna "Buque/Unidad" por "Departamento".
  - Se cambió la columna "Monto en $" por "Monto" para evitar ambigüedad entre Bs y USD.
  - Se cambió la columna "Transferencia" por "Moneda" para reflejar correctamente el contenido (Pág: SolicitudController.js).

- **Módulo de Finanzas (Caja Chica y Pagos Directos):**
  - Integración completa del módulo desde el proyecto CCH.
  - Copia de 6 modelos de Sequelize y configuración de nuevas asociaciones.
  - Creación de 3 controladores y 3 rutas de API nuevas.
  - Implementación de componentes `FinanzasDirecto.jsx` y `DistribucionCentrosCosto.jsx`.
  - Habilitación de ruta `/finanzas` en el Frontend.
  - Adición de botón de acceso rápido en el Dashboard (solo para Administradores).
  - Configuración de carga de datos iniciales (`seed_finanzas.js`) en el arranque del servidor.
  - **Distribución de Gastos:** Se corrigió el guardado de detalles mediante el parseo automático de JSON en peticiones `multipart/form-data`.
  - **Trazabilidad Global:** Integración con `SistemaService` para el conteo automático de operaciones y visualización de versión en el encabezado.
  - **Visualización de Comprobantes:**
    - Implementación de botones "Ver Comprobante" en las tablas de historial de Caja Chica y Pagos Directos.
    - Integración de acceso a documentos en el detalle expandido de gastos.
    - Habilitación de visualización de soportes en la pestaña de reportes consolidados.
    - Configuración dinámica de `fileBaseURL` para compatibilidad con entornos local y producción.
