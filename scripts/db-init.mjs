#!/usr/bin/env node
/** Crea el fichero de base de datos y su esquema. Idempotente. */
import { cargarEntorno } from './_env.mjs';
cargarEntorno();

const { crearEsquema, rutaBaseDatos } = await import('../src/lib/db.ts');
crearEsquema();
console.log('Base de datos lista en:', rutaBaseDatos());
