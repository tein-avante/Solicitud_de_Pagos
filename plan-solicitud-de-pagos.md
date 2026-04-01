# Plan del Proyecto - Solicitud de Pagos

## Tecnologías Usadas
- **Backend**: Node.js con Express, Sequelize (ORM), MySQL/SQLite, PDFKit para generación de PDF, pdf-lib para unión de archivos PDF.
- **Frontend**: React.js con Ant Design, Vite, Axios para API.
- **Estilo**: CSS de Ant Design.

## Lenguajes
-   **Backend:** Node.js (Express), Sequelize (MySQL), PDFKit, **pdf-lib (unión de archivos)**.
-   **Frontend:** React (Vite), Ant Design, Axios, Context API.

## Estructura del Proyecto
-   `/controllers`: Lógica de negocios (**Solicitudes**, Usuarios, Auth).
-   `/models`: Definición de esquemas de base de datos (Usuario, Solicitud, Proveedor).
-   `/middleware`: Protección de rutas y gestión de JWT.
-   `/services`: Servicios auxiliares (PDF, Email).
-   `/frontend/src`: Componentes de interfaz (Maestros, Formulario, Dashboard).
-   `/uploads`: Almacenamiento de archivos adjuntos.

## Resumen del Proyecto
Sistema para la gestión digital de solicitudes de pago con flujo de aprobación jerárquico.
Incluye:
- Firmas digitales con cargos oficiales.
- Autorización inter-departamental configurable para Gestores.
- Generación de PDF consolidado (Formulario + Comprobante + Soportes).
- Sincronización de datos bancarios de proveedores.
- Registro manual de la tasa BCV al momento del pago.
- Sistema de búsqueda rápida en selectores (Centros de Costo, Proveedores, Departamentos).
- Filtros avanzados en Dashboard por Proveedor y Departamento.
- Gestión de maestros y auditoría de cambios.
- Sesiones de larga duración para evitar cierres inesperados.
- **Eliminación selectiva de adjuntos**: Auditor y Administrador pueden eliminar archivos adjuntos cargados por ellos mismos o entre sí.
Sistema de gestión de solicitudes de pago que permite a las unidades solicitantes crear requerimientos, adjuntar soportes, y seguir un flujo de aprobación (Pendiente -> Autorizado -> Aprobado -> Pagado -> Cerrado). El sistema permite registrar la tasa BCV del día del pago manualmente. Los roles incluyen Solicitante, Gestor (Gerente), Administrador y Auditor. El sistema implementa una arquitectura de autorización inter-departamental robusta y sesiones prolongadas para mejorar la experiencia de usuario.

