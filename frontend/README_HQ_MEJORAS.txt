NIARSALES HQ - MEJORAS OFICINA VIRTUAL

Base: frontend funcional corregido original.

Cambios incluidos:
- Menú contextual de Nico y Ara al hacer clic sobre sus personajes.
- Acciones: trabajar, descanso, cocina, baño y reunión.
- Movimiento animado hacia coordenadas del destino y estado local visible en menú.
- Identificación de fundadores con slug separado del historial de agentes.
- Refuerzo visual de iluminación, perímetro, mobiliario, detalles de escritorios y recepción.
- Conservación de pantallas y módulos existentes.

Validación:
Se inspeccionó el contenido y estructura del paquete. No se pudo ejecutar `ng build`
porque el entorno de generación no logró instalar Angular CLI/dependencias (npm ci
excedió el tiempo disponible). Por favor validar localmente con npm ci y npm start.

Actualización de movimiento (continuación):
- Nico y Ara ahora recorren una secuencia de puntos para respetar accesos/puertas de la oficina.
- Las rutas hacia cocina, baño y living usan las entradas de cada ambiente; reunión usa la puerta de la sala.
- Se añadió animación básica de brazos y balanceo al caminar.
- La geometría/distribución de la oficina no se modificó.
- Validación de build pendiente: npm ci no terminó dentro del entorno de preparación, por lo que Angular CLI no quedó disponible para ejecutar ng build.
