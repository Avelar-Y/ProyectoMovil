This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.

## Importación de datos (Firestore Seed)

Se incluyó un script para cargar datos iniciales en Firestore desde un archivo JSON.

### 1. Obtener Service Account
En Firebase Console: Configuración del proyecto -> Cuentas de servicio -> Generar nueva clave privada. Descargar y guardar el archivo como `serviceAccount.json` en la raíz del proyecto (NO lo subas al repositorio; añádelo a `.gitignore`).

### 2. Preparar el archivo de datos
Ejemplo en `data/seed-example.json`. Estructura (para servicios ahora soporta campo opcional `duration` en minutos y `tags`):

```
{
	"users": {
		"uid1": { "email": "user@example.com", "displayName": "Usuario" }
	},
	"services": {
		"svc1": { "title": "Servicio 1", "price": 10 }
	}
}
```

Guarda tu propia versión como `data/seed.json`.

### 3. Instalar dependencias necesarias
```
npm install
```

### 4. Ejecutar importación
```
npm run seed
```
Este comando ejecuta:
```
ts-node scripts/importFirestore.ts --file data/seed-example.json --serviceAccount serviceAccount.json --merge
```

Parámetros útiles:

### 5. Buenas prácticas

### 6. Errores comunes
| Problema | Causa probable | Solución |
|----------|----------------|----------|
| PERMISSION_DENIED | Reglas restringen escritura | Usar service account o ajustar reglas |
| Project mismatch | projectId incorrecto | Verificar que la key corresponde al proyecto |
| Not found serviceAccount.json | Ruta incorrecta | Moverlo a la raíz o ajustar parámetro |


## Vista de detalle de servicio (Modal)

La pantalla `ServiceDetail` ahora se presenta como un modal tipo bottom-sheet (presentation: modal) con:
 - Cabecera con handle y botón Cerrar.
 - Botón flotante (sticky) para confirmar la reserva.
 - Dirección de destino colapsable: si ya existe una dirección (perfil o guardada localmente) se muestra en modo resumen con opción Editar.
 - Usuarios no autenticados pueden guardar una dirección local (AsyncStorage) para reutilizarla después.
 - Las reservas relacionadas se movieron a la pantalla `ServiceReservations` accesible mediante el enlace "Ver reservas relacionadas" dentro del modal.

Esto reduce la sobrecarga visual y evita listas grandes dentro del modal principal.

## Modo oscuro y preferencias de tema

Se añadió un sistema de temas con las opciones:
 - Claro
 - Oscuro
 - Sistema (se adapta dinámicamente a los cambios del SO)

La preferencia se guarda en `AsyncStorage` como `themePreference` y el tema efectivo (light/dark) se recalcula automáticamente. Paleta extendida disponible: `accent`, `danger`, `overlay`, `elevation1`, `elevation2`, `highlight`, `tabBar`.

En la pantalla `Profile` hay una sección "Apariencia" con un selector (segmentos) y un atajo para alternar rápido entre claro/oscuro.

La barra de navegación inferior ahora:
 - Tiene contenedor redondeado y sombra elevada.
 - Oculta labels por defecto (usa íconos y un texto pequeño debajo).
 - Resalta la pestaña activa con un fondo `highlight` y tinte `primary`.

## Modal de reserva activa

Se añadió la pantalla modal `ActiveReservationDetail` para mostrar la información de una reserva en curso:
 - Estado con chip coloreado.
 - Detalles del servicio (snapshot), participantes y ubicación.
 - Progreso visual (timeline: pending → confirmed → in_progress → completed).
 - Acciones contextuales: aceptar (proveedor), cancelar (cliente), editar nota/dirección (cliente en estados tempranos), abrir chat (cuando procede).
Reemplaza el acceso previo que redirigía a `ServiceDetail` desde `ActiveServices`.

## Motivo de cancelación, estado final y badges en historial

Mejoras recientes para trazabilidad y claridad del ciclo de vida de las reservas:

1. Motivo de cancelación (opcional):
	- Al pulsar "Cancelar reserva" en el modal `ActiveReservationDetail` se despliega un pequeño formulario para introducir un motivo.
	- Si se confirma, el campo `cancelReason` se guarda junto con la reserva.
	- Se muestra en el historial sólo para reservas canceladas.

2. Campo `finalState`:
	- Nueva propiedad persistida en la colección `reservations` para estados terminales.
	- Valores posibles: `completed` | `cancelled`.
	- Se escribe al finalizar (`finishService` / `confirmCompletion`) o al cancelar (`cancelReservation` / cancelación transaccional).
	- Permite distinguir una reserva que ya no debe volver a estados activos aunque `status` se sobrescriba accidentalmente.

3. Cancelación transaccional (`cancelReservationAtomic`):
	- Usa `runTransaction` para validar que la reserva no haya sido finalizada por otra acción concurrente.
	- Verifica que el estado actual esté dentro del conjunto permitido (por defecto `['pending','confirmed']`).
	- Evita condiciones de carrera entre aceptación/progreso y la cancelación del cliente.

4. Badges de estado en `History`:
	- Cada item muestra un chip coloreado según el estado (`pending`, `confirmed`, `in_progress`, `completed`, `cancelled`).
	- Colores mapeados a la paleta del tema (`muted`, `accent`, `primary`, `danger`).
	- Si la reserva está cancelada y existe `cancelReason`, se muestra debajo (máx. 3 líneas).

### Resumen de cambios en funciones Firestore
| Función | Cambio | Detalle |
|--------|--------|---------|
| `cancelReservation` | Añade `finalState: 'cancelled'` | Escritura directa (legacy) |
| `cancelReservationAtomic` | NUEVA | Transacción con validación de estado y `cancelReason` opcional |
| `finishService` | Añade `finalState: 'completed'` | Marca fin desde proveedor |
| `confirmCompletion` | Añade `finalState: 'completed'` | Confirmación cliente; opcional pago |

### Consideraciones futuras
- Un índice compuesto podría optimizar filtros por `finalState` si se implementan vistas archivadas.
- Se puede añadir métrica de tiempo total (`finishedAt - startedAt`) y causas comunes de cancelación para analítica.

## Historial mejorado (agrupación, filtros, búsqueda)

Se añadieron varias mejoras a la pantalla `History`:

- Chips compactos reutilizando componente `Chip` para filtrar múltiples estados simultáneamente (multi-select, persistidos en `AsyncStorage` bajo clave `historyFilters`).
- Búsqueda por texto (título de servicio, nombre o nota).
- Agrupación por fecha usando `SectionList` (encabezados sticky).
- Estadísticas rápidas: Activas, Completadas, Canceladas, Total.
- Estilo atenuado para completadas/canceladas para priorizar activas.
- Navegación contextual: estados activos → `ActiveReservationDetail`; terminales → `ServiceDetail` (o ficha histórica).

### Componente Chip reutilizable
Archivo: `src/components/Chip.tsx`

Props principales:
- `label`: texto.
- `active`: estado visual activo.
- `small`: variante más compacta (opcional).
- `iconLeft`: permite ícono ReactNode.

Usos:
- `Home` (categorías de servicios)
- `History` (filtros de estado)

Ventajas:
- Consistencia visual tema claro/oscuro.
- Facilidad para extender (añadir contador, ícono de cierre, etc.).


## Geocodificación automática de direcciones

Al crear una reserva (`saveReservation`) si no se proporcionan coordenadas pero sí una dirección textual (`addressLine` / `city` / `province` / `country`) el sistema intenta:

1. Geocodificar usando Google Geocoding API (clave `GOOGLE_MAPS_API_KEY`).
2. Si falla o devuelve `ZERO_RESULTS` y está permitido, hace fallback a Nominatim (OpenStreetMap).
3. Guarda `clientLocation { lat, lng, updatedAt, source }` y un hash `address.geocodeHash` para evitar recomputar si la dirección no cambió.

Al editar la dirección en `ActiveReservationDetail` se vuelve a geocodificar y se actualiza `clientLocation`.

### Variables de entorno
Definir en `.env` (no commitear):
```
GOOGLE_MAPS_API_KEY=TU_KEY
```
Android usa `manifestPlaceholders` para inyectarla en el `AndroidManifest.xml`.

### Fallback Nominatim
Uso responsable (tasa limitada). Para producción intensiva se recomienda solo Google o cache persistente.

### Errores comunes
| Código | Causa | Acción |
|--------|-------|--------|
| REQUEST_DENIED | Billing no habilitado / API desactivada | Activar Billing y Geocoding/Directions API |
| ZERO_RESULTS | Dirección insuficiente o ambigua | Pedir más detalle (ej. ciudad y país) |
| OVER_DAILY_LIMIT | Límite diario excedido | Revisar cuota / optimizar cache |

### Extensión futura
- Cache persistente (AsyncStorage) para direcciones frecuentes.
- Reverse geocoding para mostrar direcciones legibles de coordenadas capturadas.


