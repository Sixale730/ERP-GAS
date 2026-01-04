// Catalogo de Estados y Ciudades de Mexico

export interface EstadoMexico {
  value: string  // Codigo ISO 3166-2:MX
  label: string  // Nombre completo
}

export const ESTADOS_MEXICO: EstadoMexico[] = [
  { value: 'Aguascalientes', label: 'Aguascalientes' },
  { value: 'Baja California', label: 'Baja California' },
  { value: 'Baja California Sur', label: 'Baja California Sur' },
  { value: 'Campeche', label: 'Campeche' },
  { value: 'Chiapas', label: 'Chiapas' },
  { value: 'Chihuahua', label: 'Chihuahua' },
  { value: 'Ciudad de Mexico', label: 'Ciudad de Mexico' },
  { value: 'Coahuila', label: 'Coahuila' },
  { value: 'Colima', label: 'Colima' },
  { value: 'Durango', label: 'Durango' },
  { value: 'Estado de Mexico', label: 'Estado de Mexico' },
  { value: 'Guanajuato', label: 'Guanajuato' },
  { value: 'Guerrero', label: 'Guerrero' },
  { value: 'Hidalgo', label: 'Hidalgo' },
  { value: 'Jalisco', label: 'Jalisco' },
  { value: 'Michoacan', label: 'Michoacan' },
  { value: 'Morelos', label: 'Morelos' },
  { value: 'Nayarit', label: 'Nayarit' },
  { value: 'Nuevo Leon', label: 'Nuevo Leon' },
  { value: 'Oaxaca', label: 'Oaxaca' },
  { value: 'Puebla', label: 'Puebla' },
  { value: 'Queretaro', label: 'Queretaro' },
  { value: 'Quintana Roo', label: 'Quintana Roo' },
  { value: 'San Luis Potosi', label: 'San Luis Potosi' },
  { value: 'Sinaloa', label: 'Sinaloa' },
  { value: 'Sonora', label: 'Sonora' },
  { value: 'Tabasco', label: 'Tabasco' },
  { value: 'Tamaulipas', label: 'Tamaulipas' },
  { value: 'Tlaxcala', label: 'Tlaxcala' },
  { value: 'Veracruz', label: 'Veracruz' },
  { value: 'Yucatan', label: 'Yucatan' },
  { value: 'Zacatecas', label: 'Zacatecas' },
]

// Ciudades principales por estado
export const CIUDADES_MEXICO: Record<string, string[]> = {
  'Aguascalientes': [
    'Aguascalientes', 'Calvillo', 'Jesus Maria', 'Pabellon de Arteaga', 'Rincon de Romos', 'San Francisco de los Romo'
  ],
  'Baja California': [
    'Tijuana', 'Mexicali', 'Ensenada', 'Tecate', 'Rosarito', 'San Felipe', 'San Quintin'
  ],
  'Baja California Sur': [
    'La Paz', 'Los Cabos', 'San Jose del Cabo', 'Cabo San Lucas', 'Comondu', 'Loreto', 'Mulege'
  ],
  'Campeche': [
    'Campeche', 'Ciudad del Carmen', 'Champoton', 'Escarcega', 'Calakmul', 'Candelaria'
  ],
  'Chiapas': [
    'Tuxtla Gutierrez', 'San Cristobal de las Casas', 'Tapachula', 'Comitan', 'Palenque', 'Chiapa de Corzo', 'Ocosingo'
  ],
  'Chihuahua': [
    'Chihuahua', 'Ciudad Juarez', 'Delicias', 'Cuauhtemoc', 'Parral', 'Nuevo Casas Grandes', 'Camargo', 'Ojinaga'
  ],
  'Ciudad de Mexico': [
    'Alvaro Obregon', 'Azcapotzalco', 'Benito Juarez', 'Coyoacan', 'Cuajimalpa', 'Cuauhtemoc',
    'Gustavo A. Madero', 'Iztacalco', 'Iztapalapa', 'Magdalena Contreras', 'Miguel Hidalgo',
    'Milpa Alta', 'Tlahuac', 'Tlalpan', 'Venustiano Carranza', 'Xochimilco'
  ],
  'Coahuila': [
    'Saltillo', 'Torreon', 'Monclova', 'Piedras Negras', 'Acuna', 'Sabinas', 'Ramos Arizpe', 'San Pedro'
  ],
  'Colima': [
    'Colima', 'Manzanillo', 'Tecoman', 'Villa de Alvarez', 'Armeria', 'Comala', 'Coquimatlan'
  ],
  'Durango': [
    'Durango', 'Gomez Palacio', 'Lerdo', 'Santiago Papasquiaro', 'Nuevo Ideal', 'Canatllan', 'El Salto'
  ],
  'Estado de Mexico': [
    'Toluca', 'Ecatepec', 'Naucalpan', 'Tlalnepantla', 'Nezahualcoyotl', 'Atizapan', 'Cuautitlan Izcalli',
    'Texcoco', 'Chalco', 'Metepec', 'Huixquilucan', 'Coacalco', 'Tultitlan', 'Ixtapaluca', 'Tecamac'
  ],
  'Guanajuato': [
    'Leon', 'Irapuato', 'Celaya', 'Guanajuato', 'Salamanca', 'Silao', 'San Miguel de Allende',
    'Dolores Hidalgo', 'San Francisco del Rincon', 'Penjamo'
  ],
  'Guerrero': [
    'Acapulco', 'Chilpancingo', 'Iguala', 'Zihuatanejo', 'Taxco', 'Chilapa', 'Tlapa', 'Coyuca de Benitez'
  ],
  'Hidalgo': [
    'Pachuca', 'Tulancingo', 'Tula', 'Huejutla', 'Tepeji', 'Ixmiquilpan', 'Actopan', 'Tizayuca', 'Mineral de la Reforma'
  ],
  'Jalisco': [
    'Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonala', 'Tlajomulco', 'Puerto Vallarta', 'Lagos de Moreno',
    'Tepatitlan', 'El Salto', 'Ocotlan', 'Chapala', 'Autlan', 'Ciudad Guzman'
  ],
  'Michoacan': [
    'Morelia', 'Uruapan', 'Zamora', 'Lazaro Cardenas', 'Apatzingan', 'Zitacuaro', 'Patzcuaro',
    'La Piedad', 'Sahuayo', 'Hidalgo', 'Jacona'
  ],
  'Morelos': [
    'Cuernavaca', 'Jiutepec', 'Cuautla', 'Temixco', 'Yautepec', 'Emiliano Zapata', 'Xochitepec', 'Ayala'
  ],
  'Nayarit': [
    'Tepic', 'Bahia de Banderas', 'Santiago Ixcuintla', 'Compostela', 'Tuxpan', 'Tecuala', 'Acaponeta'
  ],
  'Nuevo Leon': [
    'Monterrey', 'Guadalupe', 'San Nicolas', 'Apodaca', 'Santa Catarina', 'General Escobedo',
    'San Pedro Garza Garcia', 'Juarez', 'Garcia', 'Cadereyta', 'Linares', 'Montemorelos'
  ],
  'Oaxaca': [
    'Oaxaca de Juarez', 'Santa Cruz Xoxocotlan', 'San Juan Bautista Tuxtepec', 'Salina Cruz',
    'Juchitan', 'Santa Lucia del Camino', 'Huajuapan', 'Puerto Escondido', 'Huatulco'
  ],
  'Puebla': [
    'Puebla', 'Tehuacan', 'San Martin Texmelucan', 'Atlixco', 'San Pedro Cholula', 'Amozoc',
    'San Andres Cholula', 'Huauchinango', 'Izucar de Matamoros', 'Teziutlan'
  ],
  'Queretaro': [
    'Queretaro', 'San Juan del Rio', 'Corregidora', 'El Marques', 'Tequisquiapan', 'Cadereyta', 'Ezequiel Montes'
  ],
  'Quintana Roo': [
    'Cancun', 'Chetumal', 'Playa del Carmen', 'Cozumel', 'Tulum', 'Felipe Carrillo Puerto',
    'Isla Mujeres', 'Puerto Morelos', 'Solidaridad'
  ],
  'San Luis Potosi': [
    'San Luis Potosi', 'Soledad de Graciano Sanchez', 'Ciudad Valles', 'Matehuala', 'Rio Verde',
    'Tamazunchale', 'Cedral', 'Ebano'
  ],
  'Sinaloa': [
    'Culiacan', 'Mazatlan', 'Los Mochis', 'Guasave', 'Guamuchil', 'Navolato', 'El Rosario', 'Escuinapa', 'Costa Rica'
  ],
  'Sonora': [
    'Hermosillo', 'Ciudad Obregon', 'Nogales', 'San Luis Rio Colorado', 'Guaymas', 'Navojoa',
    'Agua Prieta', 'Caborca', 'Puerto Penasco', 'Empalme'
  ],
  'Tabasco': [
    'Villahermosa', 'Cardenas', 'Comalcalco', 'Huimanguillo', 'Macuspana', 'Cunduacan',
    'Paraiso', 'Tenosique', 'Balancan'
  ],
  'Tamaulipas': [
    'Reynosa', 'Matamoros', 'Nuevo Laredo', 'Tampico', 'Ciudad Victoria', 'Ciudad Madero',
    'Altamira', 'Rio Bravo', 'El Mante', 'Valle Hermoso'
  ],
  'Tlaxcala': [
    'Tlaxcala', 'Apizaco', 'Huamantla', 'San Pablo del Monte', 'Chiautempan', 'Calpulalpan',
    'Zacatelco', 'Contla', 'Papalotla'
  ],
  'Veracruz': [
    'Veracruz', 'Xalapa', 'Coatzacoalcos', 'Cordoba', 'Poza Rica', 'Boca del Rio', 'Orizaba',
    'Minatitlan', 'Tuxpan', 'Papantla', 'San Andres Tuxtla', 'Martinez de la Torre'
  ],
  'Yucatan': [
    'Merida', 'Kanasín', 'Valladolid', 'Uman', 'Progreso', 'Tizimin', 'Motul', 'Ticul', 'Izamal'
  ],
  'Zacatecas': [
    'Zacatecas', 'Fresnillo', 'Guadalupe', 'Rio Grande', 'Jerez', 'Sombrerete', 'Loreto', 'Calera', 'Ojocaliente'
  ],
}

// Obtener ciudades por estado
export function getCiudadesByEstado(estado: string): string[] {
  return CIUDADES_MEXICO[estado] || []
}

// Buscar estado por nombre (parcial)
export function buscarEstados(texto: string): EstadoMexico[] {
  if (!texto) return ESTADOS_MEXICO
  const busqueda = texto.toLowerCase()
  return ESTADOS_MEXICO.filter(e => e.label.toLowerCase().includes(busqueda))
}

// Buscar ciudades por nombre (parcial) en un estado
export function buscarCiudades(estado: string, texto: string): string[] {
  const ciudades = getCiudadesByEstado(estado)
  if (!texto) return ciudades
  const busqueda = texto.toLowerCase()
  return ciudades.filter(c => c.toLowerCase().includes(busqueda))
}

// Verificar si un estado es de Mexico
export function esEstadoMexico(estado: string): boolean {
  return ESTADOS_MEXICO.some(e => e.value === estado || e.label === estado)
}

// Verificar si una ciudad pertenece a un estado
export function esCiudadDeEstado(estado: string, ciudad: string): boolean {
  const ciudades = getCiudadesByEstado(estado)
  return ciudades.includes(ciudad)
}
