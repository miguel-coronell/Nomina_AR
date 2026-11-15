/** Catálogo de licencias y tipos de día del registro de asistencia. */
export const TIPOS_DIA = {
  T: { label: 'Trabajado', corto: 'Trab.', clase: 'ok' },
  FI: { label: 'Falta injustificada', corto: 'F. inj.', clase: 'danger' },
  FJ: { label: 'Falta justificada (con goce)', corto: 'F. just.', clase: 'info' },
  L: { label: 'Licencia / vacaciones', corto: 'Licencia', clase: 'info' },
  NL: { label: 'Día no laborable otorgado (con goce)', corto: 'No lab.', clase: 'info' },
  BH: { label: 'Franco compensatorio (banco de horas)', corto: 'Banco', clase: 'info' },
  SG: { label: 'Licencia sin goce de haberes', corto: 'Sin goce', clase: 'warn' },
};

export const LICENCIAS = [
  { id: 'vacaciones', label: 'Vacaciones', ref: 'Arts. 150-157 LCT (fraccionables en tramos de 7 días corridos, Ley 27.802)' },
  { id: 'enfermedad', label: 'Enfermedad inculpable', ref: 'Art. 208 LCT' },
  { id: 'accidente', label: 'Accidente de trabajo / enfermedad profesional (ART)', ref: 'Ley 24.557' },
  { id: 'maternidad', label: 'Maternidad', ref: 'Art. 177 LCT' },
  { id: 'paternidad', label: 'Nacimiento de hijo', ref: 'Art. 158 LCT' },
  { id: 'matrimonio', label: 'Matrimonio', ref: 'Art. 158 LCT' },
  { id: 'fallecimiento', label: 'Fallecimiento de familiar', ref: 'Art. 158 LCT' },
  { id: 'examen', label: 'Examen / estudio', ref: 'Art. 158 LCT' },
  { id: 'otra', label: 'Otra licencia con goce de haberes', ref: 'Convenio / acuerdo' },
];
export const licenciaLabel = (id) => LICENCIAS.find((l) => l.id === id)?.label || id;
