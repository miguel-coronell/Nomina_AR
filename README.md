# Nomina AR PRO

Liquidaciones laborales argentinas (LCT 20.744 + Leyes 27.742 y 27.802). Web estática (HTML + JS modular + CSS), sin paso de build. Login con **Firebase Auth** (Google y correo/contraseña) y datos por usuario en **Firestore**.

## Puesta en marcha

```bash
npm run dev        # sirve en http://localhost:5173  (los módulos ES requieren http://, no file://)
npm test           # tests del motor de cálculo
```

### Activar Firebase
1. Creá un proyecto en <https://console.firebase.google.com> y agregá una app **Web**.
2. Pegá la configuración en `src/config/firebase.config.js`.
3. **Authentication → Sign-in method**: habilitá *Google* y *Correo/Contraseña*.
4. **Authentication → Settings → Authorized domains**: agregá tu dominio de producción.
5. **Firestore Database**: crear base y publicar `firestore.rules` (`firebase deploy --only firestore:rules`).
6. Hosting (opcional): copiá `.firebaserc.example` a `.firebaserc` y ejecutá `firebase deploy`.

Mientras `firebase.config.js` tenga los valores `TU_...`, el login ofrece un **modo demo** (datos solo en el navegador). Con Firebase configurado el modo demo desaparece.

## Funciones principales
- **Personal por hora (jornaleros)**: en la ficha, *Forma de liquidación → Jornalizado*. Al elegir convenio (ej. UOCRA CCT 76/75), categoría y zona, el **valor hora sale solo** de la escala (`src/domain/convenios/escalas.js`, con vigencias por mes). La nómina liquida *horas trabajadas × valor hora* + presentismo (20 % en UOCRA) + extras, con aportes, obra social adicional, cuota sindical de afiliados, seguro de vida y redondeo (parámetros en Configuración). Para una paritaria nueva, sumá una vigencia en `escalas.js`.
- **Empleados**: fichas completas (CUIL, CBU, periodicidad, antigüedad %, presentismo %), búsqueda y filtros, **importación masiva desde Excel/CSV** (plantilla descargable, vista previa con errores por fila, actualización por DNI) y exportación a Excel.
- **Nómina**: liquidaciones **mensuales, quincenales y SAC (aguinaldo)**. Flujo: *Borrador → carga de novedades (horas extras, ausencias, bonos, adelantos) → Liquidada → Pagos → Pagada*. Incluye control de pagos por empleado (fecha y medio), recibos de haberes (imprimir todos / PDF individual), planilla de pagos CSV y Excel con 3 hojas (nómina, pagos, detalle de conceptos), costo empresa con contribuciones patronales.
- **Liquidación final** (despido, renuncia, etc.) con motor legal, recibos y historial.

- **Tablas**: todas (empleados, nóminas, detalle de nómina, historial, recibos, vista previa de importación) tienen **buscador** por nombre, legajo y documento (ignora tildes y mayúsculas) y **paginado de a 10** (configurable a 25/50). Componentes: `core/search.js` y `core/ui/pager.js`.
- **PDF**: cada documento se ajusta automáticamente a UNA sola hoja A4 (firma incluida): se comprime la densidad solo lo necesario. Se generan como documentos reales (texto y tablas vectoriales, A4) con jsPDF + autoTable, cargados bajo demanda: liquidación final, recibos de haberes (individual o todos en un archivo) y resumen de nómina horizontal. Código en `services/pdf/`.

- **Logo y documentos con estructura legal**: el logo se sube en Configuración y aparece en recibos, liquidaciones y PDF. El **recibo de haberes** sigue el art. 140 LCT (texto Ley 27.802) y el Decreto 407/2026 (4 secciones + resumen del costo laboral con gráfico formal en barra, configurable a torta o sin gráfico, conceptos con cantidad/unidad/base, último depósito de aportes del art. 12 Dto.-ley 17.250/67). La **liquidación final** suma plazo de pago (arts. 128 y 255 bis), documentación a entregar (art. 80, ANSES PS 6.2) y cláusula de recibí. La sección *Normativa* muestra el checklist y el estado de tus datos.
  > Verificá el formato final contra el **Anexo III del Decreto 407/2026** con tu contador antes de usarlo como recibo oficial.

- **Novedades manuales**: horas extra (50 %/100 %), ausencias, feriados trabajados, bonos y adelantos se cargan a mano por empleado en cada nómina. La app ya no incluye control de asistencia ni fichaje.
- **Empleados**: lista con ficha lateral (datos generales, laborales, cobro e historial de liquidaciones), por sector.
- **Pagos y Reportes**: pantalla de pagos por lote y reportes/estadísticas anuales con descargas.
- **Pasantías educativas (Ley 26.427)**: régimen propio con validación legal (máx. 20 hs semanales y 6 h 30 diarias, duración 2–12 meses + 6), asignación estímulo no remunerativa, sin aportes, SAC ni vacaciones, solo obra social y ART, y recibo específico.

- **Compartir por WhatsApp o correo**: recibos de haberes (individual o toda la nómina) y liquidaciones finales tienen un botón *Compartir*. Toma el teléfono/correo de la ficha del empleado (se puede corregir en el momento), arma un mensaje predeterminado editable (se personaliza en *Configuración → Mensajes para compartir*, con variables `{nombre} {periodo} {neto} {fecha} {motivo} {empresa}`) y abre WhatsApp (`wa.me`, número argentino normalizado a 549…) o el correo (`mailto:`). WhatsApp y el correo no permiten adjuntar archivos automáticamente: el PDF se baja o se envía con *Compartir PDF* (Web Share, en celulares). Código en `services/share.service.js` y `features/app/shared/share.dialog.js`.
- **Móvil**: barra inferior de navegación, diálogos como hojas y las tablas se transforman en tarjetas con iconos (`core/ui/cards.js`, estilos en `components/tables.css`).

## Arquitectura

```
index.html                      Landing + simulador gratuito
pages/  login.html planes.html app.html
src/
├─ config/        firebase, app (rutas/flags), marketing (textos del login), plans
├─ core/          utilidades sin dependencias de negocio (html seguro, dom, fechas, formato, ui/toast+modal, guard)
├─ data/          repository + adapters (firestore / localStorage) ← único lugar que conoce el almacenamiento
├─ services/      auth, profile, employees, liquidations, settings, print
├─ domain/        LÓGICA PURA, sin DOM ni red
│  ├─ payroll/    periodos.js, engine.js (recibo de un empleado), run.js (corrida completa)
│  ├─ legal/      params.js (fechas y marco legal), articles.js (contenido de Normativa)
│  └─ liquidation/ engine.js + rules/ (antigüedad, haberes, despido, multas, deducciones)
├─ features/      una carpeta por pantalla
│  ├─ auth/ landing/ plans/
│  └─ app/  shell/ (router, layout)  modules/<modulo>/index.js
└─ styles/        base/ components/ layouts/ pages/ bundles/
tests/            node --test
```

Regla de dependencias: `features → services → data`, y `features/services → domain → core`. `domain` nunca toca el DOM.

### Agregar una función nueva a la app
1. Crear `src/features/app/modules/<nombre>/index.js` exportando `{ id, title, icon, group, mount(container, ctx, params) }`.
2. Sumarlo al array de `src/features/app/modules/index.js`. El menú lateral y la ruta `#/<id>` se generan solos.
3. Si necesita datos nuevos: un servicio en `services/` usando `repo.list/create/update/remove` (funciona con Firestore y local sin cambios).

### Agregar un concepto de liquidación
Escribí una regla en `domain/liquidation/rules/` que reciba `ctx` y devuelva un array de rubros, y agregala a la lista `reglas` de `engine.js`. Sumá un test en `tests/`.

## Marco legal (revisión octubre 2026)
- **Ley 27.802** (BO 06/03/2026): nuevo Art. 245 (base = remuneración mensual normal y habitual), sin preaviso en período de prueba.
- **Ley 27.742**: derogó el Art. 80 LCT (sanción) y los arts. 1 y 2 de la Ley 25.323; el motor solo calcula esas multas para egresos anteriores al 09/07/2024.
- Puntos a **verificar con un profesional** y ajustables en `domain/legal/params.js` o en Configuración: duración del período de prueba (3 / 6 / 8 meses) y fechas de corte. La Ley 27.802 estuvo sujeta a una cautelar (CGT) levantada en abril 2026 y el litigio de fondo continúa.
- Las estimaciones son orientativas, no reemplazan el criterio de un abogado/contador matriculado.

## Notas de nómina
- Los porcentajes de **contribuciones patronales** y de aportes son valores de referencia editables en Configuración: confirmalos con tu estudio contable. Las nóminas ya *liquidadas* conservan los parámetros con que se calcularon.
- Cada nómina se guarda como un único documento con todas sus líneas (≈1 KB por empleado); el límite de Firestore (1 MB) alcanza para varios cientos de empleados por período.
- Las ausencias descuentan 1/30 de la remuneración por día; las horas extras usan divisor 200. Ajustá estas reglas en `domain/payroll/engine.js`.

## Pendiente / ideas futuras
Cobro online de planes (Mercado Pago/Stripe + Cloud Function que actualice `plan`), límites por plan (`FLAGS.enforcePlanLimits`), escalas salariales por convenio, plantillas legales, multiusuario para estudios, archivo de transferencias en el formato de tu banco, libro de sueldos digital, F.931 / ARCA, vacaciones y licencias en la nómina.
